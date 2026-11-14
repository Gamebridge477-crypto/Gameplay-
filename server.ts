import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  attachSession,
  clearSessionCookie,
  hashPassword,
  requireAuth,
  requireRole,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  type AuthedRequest,
} from './server/auth';
import { db, initSchema, seedDatabase, uid } from './server/db';
import {
  canRegisterForTournament,
  canUserManageTournament,
  scoreMatchmakingCandidate,
  validateRegistrationInput,
} from './src/shared/logic';
import type { AuthUser, PublicProfile, UserRole } from './src/shared/types';

initSchema();
seedDatabase();

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '5mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '5mb' }));
app.use(attachSession);

function getUserWithProfile(userId: string): AuthUser | null {
  const row = db
    .prepare(
      `SELECT u.id as userId, u.email, u.role, u.status, u.created_at as createdAt,
              p.full_name as fullName, p.username, p.avatar_url as avatarUrl,
              p.country, p.city, p.gaming_platform as gamingPlatform,
              p.experience_level as experienceLevel, p.preferred_language as preferredLanguage,
              p.availability, p.gaming_style as gamingStyle, p.bio,
              p.favorite_games as favoriteGamesJson, p.achievements as achievementsJson,
              p.wins, p.matches_played as matchesPlayed, p.blocked_user_ids as blockedJson
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as any;

  if (!row) return null;
  return {
    userId: row.userId,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    fullName: row.fullName,
    username: row.username,
    avatarUrl: row.avatarUrl,
    country: row.country,
    city: row.city,
    gamingPlatform: row.gamingPlatform,
    experienceLevel: row.experienceLevel,
    preferredLanguage: row.preferredLanguage,
    availability: row.availability,
    gamingStyle: row.gamingStyle,
    bio: row.bio,
    favoriteGames: JSON.parse(row.favoriteGamesJson || '[]'),
    achievements: JSON.parse(row.achievementsJson || '[]'),
    wins: row.wins,
    matchesPlayed: row.matchesPlayed,
    blockedUserIds: JSON.parse(row.blockedJson || '[]'),
  };
}

function toPublicProfile(row: any): PublicProfile {
  return {
    userId: row.userId,
    fullName: row.fullName,
    username: row.username,
    avatarUrl: row.avatarUrl || '',
    country: row.country,
    city: row.city || '',
    gamingPlatform: row.gamingPlatform,
    experienceLevel: row.experienceLevel,
    preferredLanguage: row.preferredLanguage,
    availability: row.availability,
    gamingStyle: row.gamingStyle,
    bio: row.bio || '',
    favoriteGames: JSON.parse(row.favoriteGamesJson || '[]'),
    achievements: JSON.parse(row.achievementsJson || '[]'),
    wins: row.wins,
    matchesPlayed: row.matchesPlayed,
    role: row.role,
  };
}

function createNotification(userId: string, title: string, body: string, linkView: string): void {
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, link_view, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(uid('notif'), userId, title, body, linkView, new Date().toISOString());
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'GameBridge API' });
});

// ================= AUTHENTICATION =================

app.post('/api/auth/signup', (req, res) => {
  const { fullName, username, email, password, country, city, favoriteGames, gamingPlatform } = req.body || {};

  const validation = validateRegistrationInput({
    fullName,
    username,
    email,
    password,
    country,
    city,
    favoriteGames: Array.isArray(favoriteGames) ? favoriteGames : [],
    gamingPlatform,
  });

  if (!validation.valid) {
    res.status(400).json({ error: validation.errors[0], errors: validation.errors });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const cleanUsername = String(username).trim();

  const dupEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (dupEmail) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const dupUser = db.prepare('SELECT user_id FROM profiles WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
  if (dupUser) {
    res.status(409).json({ error: 'This username is already taken.' });
    return;
  }

  const userId = uid('usr');
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, status, created_at)
       VALUES (?, ?, ?, 'gamer', 'active', ?)`
    ).run(userId, normalizedEmail, hashPassword(password), now);

    db.prepare(
      `INSERT INTO profiles (
        user_id, full_name, username, avatar_url, country, city, gaming_platform,
        experience_level, preferred_language, availability, gaming_style, bio,
        favorite_games, achievements, wins, matches_played, blocked_user_ids, updated_at
      ) VALUES (?, ?, ?, '', ?, ?, ?, 'Intermediate', 'English', 'Evenings & Weekends', 'Team Player', '', ?, ?, 0, 0, '[]', ?)`
    ).run(
      userId,
      String(fullName).trim(),
      cleanUsername,
      String(country).trim(),
      String(city || '').trim(),
      String(gamingPlatform).trim(),
      JSON.stringify(favoriteGames),
      JSON.stringify(['GameBridge Founding Member']),
      now
    );

    createNotification(
      userId,
      'Welcome to GameBridge',
      'Complete your matchmaking preferences, test your latency, and register for upcoming tournaments.',
      'dashboard'
    );
  });

  tx();

  const token = signSessionToken(userId, 'gamer');
  setSessionCookie(res, token);
  const user = getUserWithProfile(userId);
  res.status(201).json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db
    .prepare('SELECT id, password_hash, role, status FROM users WHERE LOWER(email) = LOWER(?)')
    .get(String(email).trim()) as any;

  if (!row || !verifyPassword(String(password), row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (row.status === 'suspended') {
    res.status(403).json({ error: 'This account has been suspended by moderation.' });
    return;
  }

  const token = signSessionToken(row.id, row.role as UserRole);
  setSessionCookie(res, token);
  const user = getUserWithProfile(row.id);
  res.json({ user });
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthedRequest, res) => {
  if (!req.session) {
    res.json({ user: null });
    return;
  }
  const user = getUserWithProfile(req.session.userId);
  if (!user || user.status === 'suspended') {
    clearSessionCookie(res);
    res.json({ user: null });
    return;
  }
  res.json({ user });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'Email address is required.' });
    return;
  }
  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(String(email).trim()) as any;
  if (!user) {
    res.json({
      message: 'If an account matches that email, a password reset code has been generated.',
    });
    return;
  }

  const resetToken = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE id = ?').run(
    resetToken,
    expiresAt,
    user.id
  );

  // Note: In a free-tier deployment without a paid SMTP relay, we surface the reset code for immediate verification.
  res.json({
    message: 'Password reset code generated (valid for 30 minutes).',
    demoResetToken: resetToken,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || !token || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: 'Email, valid reset code, and new password (6+ chars) are required.' });
    return;
  }

  const user = db
    .prepare('SELECT id, reset_token, reset_expires_at FROM users WHERE LOWER(email) = LOWER(?)')
    .get(String(email).trim()) as any;

  if (
    !user ||
    !user.reset_token ||
    user.reset_token !== String(token).trim().toUpperCase() ||
    !user.reset_expires_at ||
    Date.now() > new Date(user.reset_expires_at).getTime()
  ) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?').run(
    hashPassword(String(newPassword)),
    user.id
  );
  res.json({ message: 'Password updated successfully. You can now log in.' });
});

// ================= OVERVIEW & GAMES =================

app.get('/api/overview', (_req, res) => {
  const totalPlayers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").get() as any).c;
  const totalTournaments = (db.prepare("SELECT COUNT(*) as c FROM tournaments WHERE status IN ('open', 'ongoing', 'completed')").get() as any).c;
  const totalCommunities = (db.prepare("SELECT COUNT(*) as c FROM communities WHERE status = 'active'").get() as any).c;
  const totalOpportunities = (db.prepare("SELECT COUNT(*) as c FROM sponsorship_opportunities WHERE status = 'open'").get() as any).c;

  const games = db
    .prepare('SELECT id, slug, title, genre, platforms, region_servers as regionServers, active_players_count as activePlayersCount FROM games ORDER BY active_players_count DESC')
    .all()
    .map((g: any) => ({ ...g, platforms: JSON.parse(g.platforms || '[]') }));

  const featuredTournaments = db
    .prepare(
      `SELECT t.*, p.username as organizerName,
              (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registeredCount
       FROM tournaments t
       JOIN profiles p ON p.user_id = t.organizer_id
       WHERE t.status IN ('open', 'ongoing')
       ORDER BY t.start_date ASC
       LIMIT 3`
    )
    .all()
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      gameTitle: t.game_title,
      organizerId: t.organizer_id,
      organizerName: t.organizerName,
      region: t.region,
      format: t.format,
      prizePool: t.prize_pool,
      maxParticipants: t.max_participants,
      registeredCount: t.registeredCount,
      registrationDeadline: t.registration_deadline,
      startDate: t.start_date,
      scheduleSummary: t.schedule_summary,
      rulesSummary: t.rules_summary,
      resultsSummary: t.results_summary,
      status: t.status,
      createdAt: t.created_at,
    }));

  const featuredCommunities = db
    .prepare(
      `SELECT c.*, p.username as ownerUsername,
              (SELECT COUNT(*) FROM community_memberships cm WHERE cm.community_id = c.id) as memberCount
       FROM communities c
       JOIN profiles p ON p.user_id = c.owner_id
       WHERE c.status = 'active'
       ORDER BY memberCount DESC
       LIMIT 4`
    )
    .all()
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      gameFocus: c.game_focus,
      region: c.region,
      city: c.city,
      clubType: c.club_type,
      description: c.description,
      rules: c.rules,
      ownerId: c.owner_id,
      ownerUsername: c.ownerUsername,
      memberCount: c.memberCount,
      status: c.status,
      createdAt: c.created_at,
    }));

  res.json({
    stats: { totalPlayers, totalTournaments, totalCommunities, totalOpportunities },
    games,
    featuredTournaments,
    featuredCommunities,
  });
});

app.get('/api/games', (_req, res) => {
  const games = db
    .prepare('SELECT id, slug, title, genre, platforms, region_servers as regionServers, active_players_count as activePlayersCount FROM games')
    .all()
    .map((g: any) => ({ ...g, platforms: JSON.parse(g.platforms || '[]') }));
  res.json({ games });
});

// ================= PROFILES & MATCHMAKING =================

app.put('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.session!.userId;
  const {
    fullName,
    country,
    city,
    gamingPlatform,
    experienceLevel,
    preferredLanguage,
    availability,
    gamingStyle,
    bio,
    favoriteGames,
    avatarUrl,
  } = req.body || {};

  if (!fullName || String(fullName).trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }

  db.prepare(
    `UPDATE profiles
     SET full_name = ?, country = ?, city = ?, gaming_platform = ?,
         experience_level = ?, preferred_language = ?, availability = ?,
         gaming_style = ?, bio = ?, favorite_games = ?, avatar_url = ?, updated_at = ?
     WHERE user_id = ?`
  ).run(
    String(fullName).trim(),
    String(country || 'Ethiopia').trim(),
    String(city || '').trim(),
    String(gamingPlatform || 'PC').trim(),
    String(experienceLevel || 'Intermediate').trim(),
    String(preferredLanguage || 'English').trim(),
    String(availability || 'Evenings').trim(),
    String(gamingStyle || 'Teamplay').trim(),
    String(bio || '').trim(),
    JSON.stringify(Array.isArray(favoriteGames) ? favoriteGames : []),
    String(avatarUrl || '').trim(),
    new Date().toISOString(),
    userId
  );

  res.json({ user: getUserWithProfile(userId) });
});

app.get('/api/profile/:username', (req, res) => {
  const row = db
    .prepare(
      `SELECT u.id as userId, u.role, p.full_name as fullName, p.username, p.avatar_url as avatarUrl,
              p.country, p.city, p.gaming_platform as gamingPlatform, p.experience_level as experienceLevel,
              p.preferred_language as preferredLanguage, p.availability, p.gaming_style as gamingStyle,
              p.bio, p.favorite_games as favoriteGamesJson, p.achievements as achievementsJson,
              p.wins, p.matches_played as matchesPlayed
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE LOWER(p.username) = LOWER(?) AND u.status = 'active'`
    )
    .get(req.params.username) as any;

  if (!row) {
    res.status(404).json({ error: 'Player profile not found.' });
    return;
  }

  const profile = toPublicProfile(row);

  const communities = db
    .prepare(
      `SELECT c.id, c.name, c.game_focus as gameFocus, c.city, cm.role
       FROM community_memberships cm
       JOIN communities c ON c.id = cm.community_id
       WHERE cm.user_id = ? AND c.status = 'active'`
    )
    .all(profile.userId);

  const tournaments = db
    .prepare(
      `SELECT t.id, t.title, t.game_title as gameTitle, t.start_date as startDate, t.status, tr.team_name as teamName
       FROM tournament_registrations tr
       JOIN tournaments t ON t.id = tr.tournament_id
       WHERE tr.user_id = ?
       ORDER BY t.start_date DESC`
    )
    .all(profile.userId);

  res.json({ profile, communities, tournaments });
});

app.get('/api/players', (req: AuthedRequest, res) => {
  const viewer = req.session ? getUserWithProfile(req.session.userId) : null;
  const blockedSet = new Set(viewer?.blockedUserIds || []);

  const rows = db
    .prepare(
      `SELECT u.id as userId, u.role, p.full_name as fullName, p.username, p.avatar_url as avatarUrl,
              p.country, p.city, p.gaming_platform as gamingPlatform, p.experience_level as experienceLevel,
              p.preferred_language as preferredLanguage, p.availability, p.gaming_style as gamingStyle,
              p.bio, p.favorite_games as favoriteGamesJson, p.achievements as achievementsJson,
              p.wins, p.matches_played as matchesPlayed
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.status = 'active'`
    )
    .all() as any[];

  const filters = {
    game: req.query.game ? String(req.query.game) : undefined,
    platform: req.query.platform ? String(req.query.platform) : undefined,
    experienceLevel: req.query.experienceLevel ? String(req.query.experienceLevel) : undefined,
    language: req.query.language ? String(req.query.language) : undefined,
    region: req.query.region ? String(req.query.region) : undefined,
    availability: req.query.availability ? String(req.query.availability) : undefined,
    gamingStyle: req.query.gamingStyle ? String(req.query.gamingStyle) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
  };

  const results = rows
    .map(toPublicProfile)
    .filter((p) => (!viewer || p.userId !== viewer.userId) && !blockedSet.has(p.userId))
    .map((p) => {
      const match = scoreMatchmakingCandidate(viewer, p, filters);
      return { profile: p, ...match };
    })
    .filter((item) => item.matches)
    .sort((a, b) => b.score - a.score);

  res.json({ players: results });
});

app.post('/api/players/block', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.session!.userId;
  const { targetUserId } = req.body || {};
  if (!targetUserId || targetUserId === userId) {
    res.status(400).json({ error: 'Valid target user ID required.' });
    return;
  }
  const user = getUserWithProfile(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const current = new Set(user.blockedUserIds);
  if (current.has(targetUserId)) {
    current.delete(targetUserId);
  } else {
    current.add(targetUserId);
  }
  db.prepare('UPDATE profiles SET blocked_user_ids = ? WHERE user_id = ?').run(
    JSON.stringify([...current]),
    userId
  );
  res.json({ blockedUserIds: [...current] });
});

// ================= TEAMS & INVITATIONS =================

app.get('/api/teams', (_req, res) => {
  const teams = db
    .prepare(
      `SELECT t.*, p.username as captainUsername,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as memberCount
       FROM teams t
       JOIN profiles p ON p.user_id = t.captain_id
       ORDER BY t.created_at DESC`
    )
    .all()
    .map((t: any) => ({
      id: t.id,
      name: t.name,
      tag: t.tag,
      gameTitle: t.game_title,
      captainId: t.captain_id,
      captainUsername: t.captainUsername,
      region: t.region,
      recruiting: Boolean(t.recruiting),
      memberCount: t.memberCount,
      createdAt: t.created_at,
    }));
  res.json({ teams });
});

app.post('/api/teams', requireAuth, (req: AuthedRequest, res) => {
  const { name, tag, gameTitle, region } = req.body || {};
  if (!name || !tag || !gameTitle) {
    res.status(400).json({ error: 'Team name, tag, and game are required.' });
    return;
  }
  const id = uid('team');
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO teams (id, name, tag, game_title, captain_id, region, recruiting, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(id, String(name).trim(), String(tag).trim().toUpperCase().slice(0, 5), String(gameTitle).trim(), req.session!.userId, String(region || 'Ethiopia').trim(), now);
    db.prepare(`INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'Captain', ?)`).run(
      id,
      req.session!.userId,
      now
    );
  });
  tx();
  res.status(201).json({ id });
});

app.get('/api/invitations', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.session!.userId;
  const rows = db
    .prepare(
      `SELECT ti.*,
              sp.username as senderUsername, sp.full_name as senderFullName,
              rp.username as receiverUsername, rp.full_name as receiverFullName,
              t.name as teamName
       FROM team_invitations ti
       JOIN profiles sp ON sp.user_id = ti.sender_id
       JOIN profiles rp ON rp.user_id = ti.receiver_id
       LEFT JOIN teams t ON t.id = ti.team_id
       WHERE ti.sender_id = ? OR ti.receiver_id = ?
       ORDER BY ti.created_at DESC`
    )
    .all(userId, userId)
    .map((r: any) => ({
      id: r.id,
      senderId: r.sender_id,
      senderUsername: r.senderUsername,
      senderFullName: r.senderFullName,
      receiverId: r.receiver_id,
      receiverUsername: r.receiverUsername,
      receiverFullName: r.receiverFullName,
      teamId: r.team_id,
      teamName: r.teamName,
      gameTitle: r.game_title,
      roleNeeded: r.role_needed,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
    }));

  res.json({ invitations: rows });
});

app.post('/api/invitations', requireAuth, (req: AuthedRequest, res) => {
  const senderId = req.session!.userId;
  const { receiverId, teamId, gameTitle, roleNeeded, message } = req.body || {};

  if (!receiverId || !gameTitle || !roleNeeded) {
    res.status(400).json({ error: 'Target player, game, and role are required.' });
    return;
  }
  if (receiverId === senderId) {
    res.status(400).json({ error: 'Cannot invite yourself.' });
    return;
  }

  const receiver = db.prepare('SELECT user_id, blocked_user_ids FROM profiles WHERE user_id = ?').get(receiverId) as any;
  if (!receiver) {
    res.status(404).json({ error: 'Target player not found.' });
    return;
  }
  const receiverBlocked = JSON.parse(receiver.blocked_user_ids || '[]') as string[];
  if (receiverBlocked.includes(senderId)) {
    res.status(403).json({ error: 'Unable to send invitation to this player.' });
    return;
  }

  const senderProfile = db.prepare('SELECT username FROM profiles WHERE user_id = ?').get(senderId) as any;
  const id = uid('inv');
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO team_invitations (id, sender_id, receiver_id, team_id, game_title, role_needed, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, senderId, receiverId, teamId || null, String(gameTitle).trim(), String(roleNeeded).trim(), String(message || '').trim(), now);

  createNotification(
    receiverId,
    `Team Invitation from ${senderProfile?.username || 'a player'}`,
    `Invited for ${gameTitle} (${roleNeeded}).`,
    'players'
  );

  res.status(201).json({ id });
});

app.patch('/api/invitations/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.session!.userId;
  const { status } = req.body || {};
  if (status !== 'accepted' && status !== 'declined') {
    res.status(400).json({ error: 'Status must be accepted or declined.' });
    return;
  }

  const inv = db.prepare('SELECT * FROM team_invitations WHERE id = ?').get(req.params.id) as any;
  if (!inv) {
    res.status(404).json({ error: 'Invitation not found.' });
    return;
  }
  if (inv.receiver_id !== userId) {
    res.status(403).json({ error: 'Only the recipient can respond to this invitation.' });
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('UPDATE team_invitations SET status = ? WHERE id = ?').run(status, inv.id);
    if (status === 'accepted' && inv.team_id) {
      db.prepare(
        `INSERT OR IGNORE INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`
      ).run(inv.team_id, userId, inv.role_needed, now);
    }
    const receiverProfile = db.prepare('SELECT username FROM profiles WHERE user_id = ?').get(userId) as any;
    createNotification(
      inv.sender_id,
      `Invitation ${status}`,
      `${receiverProfile?.username || 'Player'} ${status} your ${inv.game_title} team invitation.`,
      'players'
    );
  });

  tx();
  res.json({ ok: true, status });
});

// ================= TOURNAMENTS =================

app.get('/api/tournaments', (req: AuthedRequest, res) => {
  const userId = req.session?.userId;
  const isAdmin = req.session?.role === 'admin';
  const gameFilter = req.query.game ? String(req.query.game) : '';
  const search = req.query.search ? String(req.query.search).toLowerCase() : '';
  const statusFilter = req.query.status ? String(req.query.status) : '';

  const rows = db
    .prepare(
      `SELECT t.*, p.username as organizerName,
              (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registeredCount
       FROM tournaments t
       JOIN profiles p ON p.user_id = t.organizer_id
       ORDER BY CASE WHEN t.status = 'open' THEN 0 WHEN t.status = 'ongoing' THEN 1 WHEN t.status = 'pending_approval' THEN 2 ELSE 3 END, t.start_date ASC`
    )
    .all() as any[];

  const regRows = userId
    ? (db.prepare('SELECT tournament_id FROM tournament_registrations WHERE user_id = ?').all(userId) as any[])
    : [];
  const myRegs = new Set(regRows.map((r) => r.tournament_id));

  const tournaments = rows
    .filter((t) => {
      if (t.status === 'pending_approval' || t.status === 'rejected') {
        if (!isAdmin && t.organizer_id !== userId) return false;
      }
      if (gameFilter && gameFilter !== 'All' && t.game_title.toLowerCase() !== gameFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter && statusFilter !== 'All' && t.status !== statusFilter) {
        return false;
      }
      if (search) {
        const hay = `${t.title} ${t.game_title} ${t.region} ${t.format}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      gameTitle: t.game_title,
      organizerId: t.organizer_id,
      organizerName: t.organizerName,
      region: t.region,
      format: t.format,
      prizePool: t.prize_pool,
      maxParticipants: t.max_participants,
      registeredCount: t.registeredCount,
      registrationDeadline: t.registration_deadline,
      startDate: t.start_date,
      scheduleSummary: t.schedule_summary,
      rulesSummary: t.rules_summary,
      resultsSummary: t.results_summary,
      status: t.status,
      isRegistered: myRegs.has(t.id),
      createdAt: t.created_at,
    }));

  res.json({ tournaments });
});

app.get('/api/tournaments/:id', (req: AuthedRequest, res) => {
  const row = db
    .prepare(
      `SELECT t.*, p.username as organizerName,
              (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registeredCount
       FROM tournaments t
       JOIN profiles p ON p.user_id = t.organizer_id
       WHERE t.id = ?`
    )
    .get(req.params.id) as any;

  if (!row) {
    res.status(404).json({ error: 'Tournament not found.' });
    return;
  }

  const participants = db
    .prepare(
      `SELECT tr.id, tr.tournament_id as tournamentId, tr.user_id as userId, p.username,
              tr.team_name as teamName, tr.in_game_id as inGameId, tr.status, tr.created_at as createdAt
       FROM tournament_registrations tr
       JOIN profiles p ON p.user_id = tr.user_id
       WHERE tr.tournament_id = ?
       ORDER BY tr.created_at ASC`
    )
    .all(row.id);

  const isRegistered = req.session
    ? Boolean(
        db
          .prepare('SELECT id FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?')
          .get(row.id, req.session.userId)
      )
    : false;

  res.json({
    tournament: {
      id: row.id,
      title: row.title,
      gameTitle: row.game_title,
      organizerId: row.organizer_id,
      organizerName: row.organizerName,
      region: row.region,
      format: row.format,
      prizePool: row.prize_pool,
      maxParticipants: row.max_participants,
      registeredCount: row.registeredCount,
      registrationDeadline: row.registration_deadline,
      startDate: row.start_date,
      scheduleSummary: row.schedule_summary,
      rulesSummary: row.rules_summary,
      resultsSummary: row.results_summary,
      status: row.status,
      isRegistered,
      createdAt: row.created_at,
    },
    participants,
  });
});

app.post('/api/tournaments', requireAuth, (req: AuthedRequest, res) => {
  const {
    title,
    gameTitle,
    region,
    format,
    prizePool,
    maxParticipants,
    registrationDeadline,
    startDate,
    scheduleSummary,
    rulesSummary,
  } = req.body || {};

  if (!title || !gameTitle || !format || !registrationDeadline || !startDate) {
    res.status(400).json({ error: 'Title, game, format, registration deadline, and start date are required.' });
    return;
  }

  const id = uid('trn');
  const now = new Date().toISOString();
  const initialStatus =
    req.session!.role === 'admin' || req.session!.role === 'organizer' ? 'open' : 'pending_approval';

  db.prepare(
    `INSERT INTO tournaments (
      id, title, game_title, organizer_id, region, format, prize_pool, max_participants,
      registration_deadline, start_date, schedule_summary, rules_summary, results_summary, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
  ).run(
    id,
    String(title).trim(),
    String(gameTitle).trim(),
    req.session!.userId,
    String(region || 'Ethiopia').trim(),
    String(format).trim(),
    String(prizePool || 'Community Trophy & Rank Points').trim(),
    Math.max(4, Math.min(256, Number(maxParticipants) || 32)),
    String(registrationDeadline),
    String(startDate),
    String(scheduleSummary || 'Schedule will be announced after check-in.').trim(),
    String(rulesSummary || 'Fair play, zero toxicity, screenshot verification required.').trim(),
    initialStatus,
    now
  );

  res.status(201).json({ id, status: initialStatus });
});

app.patch('/api/tournaments/:id', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: 'Tournament not found.' });
    return;
  }

  const canManage = canUserManageTournament(
    { userId: req.session!.userId, role: req.session!.role },
    { organizerId: row.organizer_id }
  );
  if (!canManage) {
    res.status(403).json({ error: 'Only the tournament organizer or an admin can edit this tournament.' });
    return;
  }

  const { status, resultsSummary, scheduleSummary } = req.body || {};
  let nextStatus = row.status;
  if (status && ['open', 'ongoing', 'completed'].includes(status)) {
    if (row.status === 'pending_approval' && req.session!.role !== 'admin') {
      res.status(403).json({ error: 'Admin approval is required before opening a pending tournament.' });
      return;
    }
    nextStatus = status;
  }

  db.prepare(
    `UPDATE tournaments SET status = ?, results_summary = ?, schedule_summary = ? WHERE id = ?`
  ).run(
    nextStatus,
    resultsSummary !== undefined ? String(resultsSummary).trim() : row.results_summary,
    scheduleSummary !== undefined ? String(scheduleSummary).trim() : row.schedule_summary,
    row.id
  );

  res.json({ ok: true, status: nextStatus });
});

app.post('/api/tournaments/:id/register', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.session!.userId;
  const { teamName, inGameId } = req.body || {};
  if (!inGameId || String(inGameId).trim().length < 2) {
    res.status(400).json({ error: 'In-game ID / tag is required to register.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registeredCount
       FROM tournaments t WHERE t.id = ?`
    )
    .get(req.params.id) as any;

  if (!row) {
    res.status(404).json({ error: 'Tournament not found.' });
    return;
  }

  const check = canRegisterForTournament(
    {
      status: row.status,
      registrationDeadline: row.registration_deadline,
      maxParticipants: row.max_participants,
    },
    row.registeredCount,
    new Date().toISOString()
  );

  if (!check.allowed) {
    res.status(400).json({ error: check.reason });
    return;
  }

  const dup = db
    .prepare('SELECT id FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?')
    .get(row.id, userId);
  if (dup) {
    res.status(409).json({ error: 'You are already registered for this tournament.' });
    return;
  }

  const id = uid('reg');
  db.prepare(
    `INSERT INTO tournament_registrations (id, tournament_id, user_id, team_name, in_game_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'confirmed', ?)`
  ).run(id, row.id, userId, String(teamName || 'Solo / Free Agent').trim(), String(inGameId).trim(), new Date().toISOString());

  createNotification(
    userId,
    `Registered: ${row.title}`,
    `Your slot for ${row.game_title} is confirmed.`,
    'tournaments'
  );

  res.status(201).json({ id });
});

// ================= COMMUNITIES =================

app.get('/api/communities', (req: AuthedRequest, res) => {
  const userId = req.session?.userId;
  const rows = db
    .prepare(
      `SELECT c.*, p.username as ownerUsername,
              (SELECT COUNT(*) FROM community_memberships cm WHERE cm.community_id = c.id) as memberCount
       FROM communities c
       JOIN profiles p ON p.user_id = c.owner_id
       WHERE c.status = 'active'
       ORDER BY memberCount DESC, c.created_at DESC`
    )
    .all() as any[];

  const myMemberships = userId
    ? new Set(
        (db.prepare('SELECT community_id FROM community_memberships WHERE user_id = ?').all(userId) as any[]).map(
          (r) => r.community_id
        )
      )
    : new Set<string>();

  res.json({
    communities: rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      gameFocus: c.game_focus,
      region: c.region,
      city: c.city,
      clubType: c.club_type,
      description: c.description,
      rules: c.rules,
      ownerId: c.owner_id,
      ownerUsername: c.ownerUsername,
      memberCount: c.memberCount,
      isMember: myMemberships.has(c.id),
      status: c.status,
      createdAt: c.created_at,
    })),
  });
});

app.get('/api/communities/:id', (req: AuthedRequest, res) => {
  const c = db
    .prepare(
      `SELECT c.*, p.username as ownerUsername,
              (SELECT COUNT(*) FROM community_memberships cm WHERE cm.community_id = c.id) as memberCount
       FROM communities c
       JOIN profiles p ON p.user_id = c.owner_id
       WHERE c.id = ?`
    )
    .get(req.params.id) as any;

  if (!c) {
    res.status(404).json({ error: 'Community not found.' });
    return;
  }

  const isMember = req.session
    ? Boolean(
        db
          .prepare('SELECT 1 FROM community_memberships WHERE community_id = ? AND user_id = ?')
          .get(c.id, req.session.userId)
      )
    : false;

  const posts = db
    .prepare(
      `SELECT cp.*, p.username as authorUsername, p.full_name as authorName
       FROM community_posts cp
       JOIN profiles p ON p.user_id = cp.author_id
       WHERE cp.community_id = ?
       ORDER BY cp.created_at DESC`
    )
    .all(c.id)
    .map((p: any) => ({
      id: p.id,
      communityId: p.community_id,
      authorId: p.author_id,
      authorUsername: p.authorUsername,
      authorName: p.authorName,
      postType: p.post_type,
      title: p.title,
      content: p.content,
      eventDate: p.event_date,
      createdAt: p.created_at,
    }));

  res.json({
    community: {
      id: c.id,
      name: c.name,
      slug: c.slug,
      gameFocus: c.game_focus,
      region: c.region,
      city: c.city,
      clubType: c.club_type,
      description: c.description,
      rules: c.rules,
      ownerId: c.owner_id,
      ownerUsername: c.ownerUsername,
      memberCount: c.memberCount,
      isMember,
      status: c.status,
      createdAt: c.created_at,
    },
    posts,
  });
});

app.post('/api/communities', requireAuth, (req: AuthedRequest, res) => {
  const { name, gameFocus, region, city, clubType, description, rules } = req.body || {};
  if (!name || !gameFocus || !description) {
    res.status(400).json({ error: 'Community name, game focus, and description are required.' });
    return;
  }

  const id = uid('comm');
  const slug =
    String(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    crypto.randomBytes(2).toString('hex');
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO communities (id, name, slug, game_focus, region, city, club_type, description, rules, owner_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    ).run(
      id,
      String(name).trim(),
      slug,
      String(gameFocus).trim(),
      String(region || 'Ethiopia').trim(),
      String(city || '').trim(),
      String(clubType || 'Gaming Club').trim(),
      String(description).trim(),
      String(rules || 'Respect all members and adhere to GameBridge fair-play guidelines.').trim(),
      req.session!.userId,
      now
    );

    db.prepare(
      `INSERT INTO community_memberships (community_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`
    ).run(id, req.session!.userId, now);
  });

  tx();
  res.status(201).json({ id });
});

app.post('/api/communities/:id/join', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.session!.userId;
  const comm = db.prepare('SELECT id, name FROM communities WHERE id = ? AND status = ?').get(req.params.id, 'active') as any;
  if (!comm) {
    res.status(404).json({ error: 'Community not found.' });
    return;
  }

  const existing = db
    .prepare('SELECT role FROM community_memberships WHERE community_id = ? AND user_id = ?')
    .get(comm.id, userId) as any;

  if (existing) {
    if (existing.role === 'owner') {
      res.status(400).json({ error: 'Community founders cannot leave their own club.' });
      return;
    }
    db.prepare('DELETE FROM community_memberships WHERE community_id = ? AND user_id = ?').run(comm.id, userId);
    res.json({ isMember: false });
  } else {
    db.prepare(
      `INSERT INTO community_memberships (community_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`
    ).run(comm.id, userId, new Date().toISOString());
    res.json({ isMember: true });
  }
});

app.post('/api/communities/:id/posts', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.session!.userId;
  const { postType, title, content, eventDate } = req.body || {};
  if (!title || !content) {
    res.status(400).json({ error: 'Post title and content are required.' });
    return;
  }

  const membership = db
    .prepare('SELECT role FROM community_memberships WHERE community_id = ? AND user_id = ?')
    .get(req.params.id, userId);

  if (!membership && req.session!.role !== 'admin') {
    res.status(403).json({ error: 'Join this community first to share announcements or team activities.' });
    return;
  }

  const validType = ['announcement', 'activity', 'discussion'].includes(postType) ? postType : 'announcement';
  const id = uid('post');
  db.prepare(
    `INSERT INTO community_posts (id, community_id, author_id, post_type, title, content, event_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.params.id,
    userId,
    validType,
    String(title).trim(),
    String(content).trim(),
    eventDate ? String(eventDate).trim() : null,
    new Date().toISOString()
  );

  res.status(201).json({ id });
});

// ================= OPPORTUNITIES & ORGANIZATIONS =================

app.get('/api/organizations', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, p.username as ownerUsername
       FROM organizations o
       JOIN profiles p ON p.user_id = o.owner_id
       ORDER BY o.verified_status DESC, o.created_at DESC`
    )
    .all()
    .map((o: any) => ({
      id: o.id,
      ownerId: o.owner_id,
      ownerUsername: o.ownerUsername,
      name: o.name,
      orgType: o.org_type,
      country: o.country,
      city: o.city,
      website: o.website,
      description: o.description,
      verifiedStatus: o.verified_status,
      createdAt: o.created_at,
    }));
  res.json({ organizations: rows });
});

app.post('/api/organizations', requireAuth, (req: AuthedRequest, res) => {
  const { name, orgType, country, city, website, description } = req.body || {};
  if (!name || !orgType || !description) {
    res.status(400).json({ error: 'Organization name, type, and description are required.' });
    return;
  }

  const id = uid('org');
  const status = req.session!.role === 'admin' ? 'verified' : 'pending';
  db.prepare(
    `INSERT INTO organizations (id, owner_id, name, org_type, country, city, website, description, verified_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.session!.userId,
    String(name).trim(),
    ['sponsor', 'club', 'organizer', 'academy'].includes(orgType) ? orgType : 'club',
    String(country || 'Ethiopia').trim(),
    String(city || '').trim(),
    String(website || '').trim(),
    String(description).trim(),
    status,
    new Date().toISOString()
  );

  res.status(201).json({ id, verifiedStatus: status });
});

app.get('/api/opportunities', (req: AuthedRequest, res) => {
  const userId = req.session?.userId;
  const rows = db
    .prepare(
      `SELECT s.*, o.name as orgName, o.verified_status as orgVerifiedStatus
       FROM sponsorship_opportunities s
       JOIN organizations o ON o.id = s.org_id
       WHERE o.verified_status = 'verified'
       ORDER BY s.created_at DESC`
    )
    .all() as any[];

  const appliedSet = userId
    ? new Set(
        (db.prepare('SELECT opportunity_id FROM opportunity_applications WHERE user_id = ?').all(userId) as any[]).map(
          (r) => r.opportunity_id
        )
      )
    : new Set<string>();

  res.json({
    opportunities: rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      orgName: r.orgName,
      orgVerified: r.orgVerifiedStatus === 'verified',
      title: r.title,
      category: r.category,
      region: r.region,
      deadline: r.deadline,
      description: r.description,
      requirements: r.requirements,
      status: r.status,
      hasApplied: appliedSet.has(r.id),
      createdAt: r.created_at,
    })),
  });
});

app.post('/api/opportunities', requireAuth, (req: AuthedRequest, res) => {
  const { orgId, title, category, region, deadline, description, requirements } = req.body || {};
  if (!orgId || !title || !category || !description) {
    res.status(400).json({ error: 'Organization, title, category, and description are required.' });
    return;
  }

  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as any;
  if (!org) {
    res.status(404).json({ error: 'Organization not found.' });
    return;
  }
  if (org.verified_status !== 'verified') {
    res.status(403).json({ error: 'Only verified organizations can publish official opportunities.' });
    return;
  }
  if (org.owner_id !== req.session!.userId && req.session!.role !== 'admin') {
    res.status(403).json({ error: 'You do not manage this organization.' });
    return;
  }

  const id = uid('opp');
  db.prepare(
    `INSERT INTO sponsorship_opportunities (id, org_id, title, category, region, deadline, description, requirements, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    id,
    org.id,
    String(title).trim(),
    ['sponsorship', 'club', 'event', 'career', 'equipment'].includes(category) ? category : 'sponsorship',
    String(region || 'Ethiopia').trim(),
    String(deadline || '2026-12-31').trim(),
    String(description).trim(),
    String(requirements || 'Active GameBridge account').trim(),
    new Date().toISOString()
  );

  res.status(201).json({ id });
});

app.post('/api/opportunities/:id/apply', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.session!.userId;
  const { pitch, portfolioLink } = req.body || {};
  if (!pitch || String(pitch).trim().length < 10) {
    res.status(400).json({ error: 'Please include a short pitch (at least 10 characters).' });
    return;
  }

  const opp = db.prepare('SELECT id, title FROM sponsorship_opportunities WHERE id = ?').get(req.params.id) as any;
  if (!opp) {
    res.status(404).json({ error: 'Opportunity not found.' });
    return;
  }

  const dup = db
    .prepare('SELECT id FROM opportunity_applications WHERE opportunity_id = ? AND user_id = ?')
    .get(opp.id, userId);
  if (dup) {
    res.status(409).json({ error: 'You have already applied to this opportunity.' });
    return;
  }

  const id = uid('app');
  db.prepare(
    `INSERT INTO opportunity_applications (id, opportunity_id, user_id, pitch, portfolio_link, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'submitted', ?)`
  ).run(id, opp.id, userId, String(pitch).trim(), String(portfolioLink || '').trim(), new Date().toISOString());

  createNotification(
    userId,
    'Application Submitted',
    `Your application for "${opp.title}" has been recorded.`,
    'opportunities'
  );

  res.status(201).json({ id });
});

// ================= NOTIFICATIONS & REPORTS =================

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT id, user_id as userId, title, body, link_view as linkView, is_read as isRead, created_at as createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(req.session!.userId)
    .map((n: any) => ({ ...n, isRead: Boolean(n.isRead) }));
  res.json({ notifications: rows });
});

app.patch('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.session!.userId);
  res.json({ ok: true });
});

app.post('/api/reports', requireAuth, (req: AuthedRequest, res) => {
  const { targetType, targetId, targetLabel, reason, details } = req.body || {};
  if (!targetType || !targetId || !reason) {
    res.status(400).json({ error: 'Target type, target ID, and reason are required.' });
    return;
  }

  const id = uid('rep');
  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, target_label, reason, details, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    id,
    req.session!.userId,
    ['user', 'community', 'post', 'tournament'].includes(targetType) ? targetType : 'community',
    String(targetId),
    String(targetLabel || targetId),
    String(reason).trim(),
    String(details || '').trim(),
    new Date().toISOString()
  );

  res.status(201).json({ id });
});

// ================= GAMER DASHBOARD =================

app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res) => {
  const user = getUserWithProfile(req.session!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const allOthers = db
    .prepare(
      `SELECT u.id as userId, u.role, p.full_name as fullName, p.username, p.avatar_url as avatarUrl,
              p.country, p.city, p.gaming_platform as gamingPlatform, p.experience_level as experienceLevel,
              p.preferred_language as preferredLanguage, p.availability, p.gaming_style as gamingStyle,
              p.bio, p.favorite_games as favoriteGamesJson, p.achievements as achievementsJson,
              p.wins, p.matches_played as matchesPlayed
       FROM users u JOIN profiles p ON p.user_id = u.id
       WHERE u.status = 'active' AND u.id != ?`
    )
    .all(user.userId) as any[];

  const blockedSet = new Set(user.blockedUserIds);
  const recommendedTeammates = allOthers
    .map(toPublicProfile)
    .filter((p) => !blockedSet.has(p.userId))
    .map((p) => ({ profile: p, ...scoreMatchmakingCandidate(user, p, {}) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const upcomingTournaments = db
    .prepare(
      `SELECT t.*, p.username as organizerName,
              (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registeredCount,
              EXISTS(SELECT 1 FROM tournament_registrations tr2 WHERE tr2.tournament_id = t.id AND tr2.user_id = ?) as isRegistered
       FROM tournaments t
       JOIN profiles p ON p.user_id = t.organizer_id
       WHERE t.status IN ('open', 'ongoing')
       ORDER BY isRegistered DESC, t.start_date ASC
       LIMIT 4`
    )
    .all(user.userId)
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      gameTitle: t.game_title,
      organizerId: t.organizer_id,
      organizerName: t.organizerName,
      region: t.region,
      format: t.format,
      prizePool: t.prize_pool,
      maxParticipants: t.max_participants,
      registeredCount: t.registeredCount,
      registrationDeadline: t.registration_deadline,
      startDate: t.start_date,
      scheduleSummary: t.schedule_summary,
      rulesSummary: t.rules_summary,
      resultsSummary: t.results_summary,
      status: t.status,
      isRegistered: Boolean(t.isRegistered),
      createdAt: t.created_at,
    }));

  const communities = db
    .prepare(
      `SELECT c.*, p.username as ownerUsername,
              (SELECT COUNT(*) FROM community_memberships cm WHERE cm.community_id = c.id) as memberCount,
              EXISTS(SELECT 1 FROM community_memberships cm2 WHERE cm2.community_id = c.id AND cm2.user_id = ?) as isMember
       FROM communities c
       JOIN profiles p ON p.user_id = c.owner_id
       WHERE c.status = 'active'
       ORDER BY isMember DESC, memberCount DESC
       LIMIT 4`
    )
    .all(user.userId)
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      gameFocus: c.game_focus,
      region: c.region,
      city: c.city,
      clubType: c.club_type,
      description: c.description,
      rules: c.rules,
      ownerId: c.owner_id,
      ownerUsername: c.ownerUsername,
      memberCount: c.memberCount,
      isMember: Boolean(c.isMember),
      status: c.status,
      createdAt: c.created_at,
    }));

  const notifications = db
    .prepare(
      `SELECT id, user_id as userId, title, body, link_view as linkView, is_read as isRead, created_at as createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 8`
    )
    .all(user.userId)
    .map((n: any) => ({ ...n, isRead: Boolean(n.isRead) }));

  const recentPosts = db
    .prepare(
      `SELECT cp.id, cp.title, cp.post_type as postType, cp.created_at as createdAt, c.name as communityName, p.username as authorUsername
       FROM community_posts cp
       JOIN communities c ON c.id = cp.community_id
       JOIN profiles p ON p.user_id = cp.author_id
       ORDER BY cp.created_at DESC LIMIT 5`
    )
    .all();

  const myTournamentCount = (
    db.prepare('SELECT COUNT(*) as c FROM tournament_registrations WHERE user_id = ?').get(user.userId) as any
  ).c;
  const myCommunityCount = (
    db.prepare('SELECT COUNT(*) as c FROM community_memberships WHERE user_id = ?').get(user.userId) as any
  ).c;
  const pendingInvitesCount = (
    db.prepare("SELECT COUNT(*) as c FROM team_invitations WHERE receiver_id = ? AND status = 'pending'").get(user.userId) as any
  ).c;

  res.json({
    user,
    recommendedTeammates,
    upcomingTournaments,
    communities,
    notifications,
    recentPosts,
    gamingStats: {
      wins: user.wins,
      matchesPlayed: user.matchesPlayed,
      winRate: user.matchesPlayed > 0 ? Math.round((user.wins / user.matchesPlayed) * 100) : 0,
      tournamentsJoined: myTournamentCount,
      communitiesJoined: myCommunityCount,
      pendingInvites: pendingInvitesCount,
    },
  });
});

// ================= INTERNET CONNECTION CHECKER =================

const DOWNLOAD_PAYLOAD = Buffer.alloc(512 * 1024, 0x47); // 512 KB deterministic test payload

app.get('/api/network/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ ts: Date.now() });
});

app.get('/api/network/download', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(DOWNLOAD_PAYLOAD);
});

app.post('/api/network/upload', (req, res) => {
  const bytes = Buffer.isBuffer(req.body) ? req.body.length : JSON.stringify(req.body || {}).length;
  res.json({ receivedBytes: bytes, ts: Date.now() });
});

app.get('/api/network/tests', (req: AuthedRequest, res) => {
  const userId = req.session?.userId;
  const rows = userId
    ? db
        .prepare(
          `SELECT id, region_node as regionNode, download_mbps as downloadMbps, upload_mbps as uploadMbps,
                  ping_ms as pingMs, jitter_ms as jitterMs, stability, created_at as createdAt
           FROM connection_tests WHERE user_id = ? ORDER BY created_at DESC LIMIT 8`
        )
        .all(userId)
    : db
        .prepare(
          `SELECT id, region_node as regionNode, download_mbps as downloadMbps, upload_mbps as uploadMbps,
                  ping_ms as pingMs, jitter_ms as jitterMs, stability, created_at as createdAt
           FROM connection_tests ORDER BY created_at DESC LIMIT 5`
        )
        .all();

  res.json({ history: rows });
});

app.post('/api/network/tests', (req: AuthedRequest, res) => {
  const { regionNode, downloadMbps, uploadMbps, pingMs, jitterMs, stability } = req.body || {};
  const id = uid('conn');
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO connection_tests (id, user_id, region_node, download_mbps, upload_mbps, ping_ms, jitter_ms, stability, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.session?.userId || null,
    String(regionNode || 'Addis Ababa Relay'),
    Number(downloadMbps) || 0,
    Number(uploadMbps) || 0,
    Number(pingMs) || 0,
    Number(jitterMs) || 0,
    String(stability || 'Stable'),
    now
  );
  res.status(201).json({ id, createdAt: now });
});

// ================= ADMIN DASHBOARD =================

app.get('/api/admin/overview', requireRole(['admin']), (_req, res) => {
  const stats = {
    totalUsers: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
    totalTournaments: (db.prepare('SELECT COUNT(*) as c FROM tournaments').get() as any).c,
    totalCommunities: (db.prepare('SELECT COUNT(*) as c FROM communities').get() as any).c,
    totalOpportunities: (db.prepare('SELECT COUNT(*) as c FROM sponsorship_opportunities').get() as any).c,
    openReports: (db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'open'").get() as any).c,
    pendingTournaments: (db.prepare("SELECT COUNT(*) as c FROM tournaments WHERE status = 'pending_approval'").get() as any).c,
    pendingOrgs: (db.prepare("SELECT COUNT(*) as c FROM organizations WHERE verified_status = 'pending'").get() as any).c,
    totalRegistrations: (db.prepare('SELECT COUNT(*) as c FROM tournament_registrations').get() as any).c,
  };

  const users = db
    .prepare(
      `SELECT u.id as userId, u.email, u.role, u.status, u.created_at as createdAt,
              p.full_name as fullName, p.username, p.country, p.city, p.gaming_platform as gamingPlatform
       FROM users u JOIN profiles p ON p.user_id = u.id
       ORDER BY u.created_at DESC`
    )
    .all();

  const tournaments = db
    .prepare(
      `SELECT t.*, p.username as organizerName,
              (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registeredCount
       FROM tournaments t JOIN profiles p ON p.user_id = t.organizer_id
       ORDER BY CASE WHEN t.status = 'pending_approval' THEN 0 ELSE 1 END, t.created_at DESC`
    )
    .all()
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      gameTitle: t.game_title,
      organizerId: t.organizer_id,
      organizerName: t.organizerName,
      region: t.region,
      format: t.format,
      prizePool: t.prize_pool,
      maxParticipants: t.max_participants,
      registeredCount: t.registeredCount,
      registrationDeadline: t.registration_deadline,
      startDate: t.start_date,
      scheduleSummary: t.schedule_summary,
      rulesSummary: t.rules_summary,
      resultsSummary: t.results_summary,
      status: t.status,
      createdAt: t.created_at,
    }));

  const communities = db
    .prepare(
      `SELECT c.*, p.username as ownerUsername,
              (SELECT COUNT(*) FROM community_memberships cm WHERE cm.community_id = c.id) as memberCount
       FROM communities c JOIN profiles p ON p.user_id = c.owner_id
       ORDER BY c.created_at DESC`
    )
    .all()
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      gameFocus: c.game_focus,
      region: c.region,
      city: c.city,
      clubType: c.club_type,
      description: c.description,
      rules: c.rules,
      ownerId: c.owner_id,
      ownerUsername: c.ownerUsername,
      memberCount: c.memberCount,
      status: c.status,
      createdAt: c.created_at,
    }));

  const reports = db
    .prepare(
      `SELECT r.*, p.username as reporterUsername
       FROM reports r JOIN profiles p ON p.user_id = r.reporter_id
       ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.created_at DESC`
    )
    .all()
    .map((r: any) => ({
      id: r.id,
      reporterId: r.reporter_id,
      reporterUsername: r.reporterUsername,
      targetType: r.target_type,
      targetId: r.target_id,
      targetLabel: r.target_label,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
    }));

  const organizations = db
    .prepare(
      `SELECT o.*, p.username as ownerUsername
       FROM organizations o JOIN profiles p ON p.user_id = o.owner_id
       ORDER BY CASE WHEN o.verified_status = 'pending' THEN 0 ELSE 1 END, o.created_at DESC`
    )
    .all()
    .map((o: any) => ({
      id: o.id,
      ownerId: o.owner_id,
      ownerUsername: o.ownerUsername,
      name: o.name,
      orgType: o.org_type,
      country: o.country,
      city: o.city,
      website: o.website,
      description: o.description,
      verifiedStatus: o.verified_status,
      createdAt: o.created_at,
    }));

  res.json({ stats, users, tournaments, communities, reports, organizations });
});

app.patch('/api/admin/tournaments/:id', requireRole(['admin']), (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'rejected', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Invalid status.' });
    return;
  }
  db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run(status, req.params.id);
  const trn = db.prepare('SELECT organizer_id, title FROM tournaments WHERE id = ?').get(req.params.id) as any;
  if (trn) {
    createNotification(
      trn.organizer_id,
      `Tournament ${status === 'open' ? 'Approved' : 'Updated'}`,
      `"${trn.title}" status is now ${status}.`,
      'tournaments'
    );
  }
  res.json({ ok: true });
});

app.patch('/api/admin/reports/:id', requireRole(['admin']), (req: AuthedRequest, res) => {
  const { status } = req.body || {};
  if (!['reviewed', 'dismissed', 'action_taken'].includes(status)) {
    res.status(400).json({ error: 'Invalid report status.' });
    return;
  }
  db.prepare('UPDATE reports SET status = ?, reviewed_by = ? WHERE id = ?').run(
    status,
    req.session!.userId,
    req.params.id
  );
  res.json({ ok: true });
});

app.patch('/api/admin/organizations/:id', requireRole(['admin']), (req, res) => {
  const { verifiedStatus } = req.body || {};
  if (!['verified', 'rejected'].includes(verifiedStatus)) {
    res.status(400).json({ error: 'Invalid verification status.' });
    return;
  }
  db.prepare('UPDATE organizations SET verified_status = ? WHERE id = ?').run(verifiedStatus, req.params.id);
  res.json({ ok: true });
});

app.patch('/api/admin/users/:id', requireRole(['admin']), (req: AuthedRequest, res) => {
  if (req.params.id === req.session!.userId && req.body?.status === 'suspended') {
    res.status(400).json({ error: 'You cannot suspend your own admin account.' });
    return;
  }
  const { role, status } = req.body || {};
  if (role && ['gamer', 'organizer', 'admin'].includes(role)) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  }
  if (status && ['active', 'suspended'].includes(status)) {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
  }
  res.json({ ok: true });
});

app.patch('/api/admin/communities/:id', requireRole(['admin']), (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'suspended'].includes(status)) {
    res.status(400).json({ error: 'Invalid community status.' });
    return;
  }
  db.prepare('UPDATE communities SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// ================= VITE / STATIC SERVER =================

async function startServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const runningBuiltServer = process.argv[1]?.endsWith('server.mjs');
  const isProd = (process.env.NODE_ENV === 'production' || runningBuiltServer) && fs.existsSync(distPath);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GameBridge running on http://localhost:${PORT}`);
  });
}

startServer();
