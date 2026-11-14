import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth';

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'gamebridge.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'gamer' CHECK (role IN ('gamer', 'organizer', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      reset_token TEXT,
      reset_expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      avatar_url TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      gaming_platform TEXT NOT NULL,
      experience_level TEXT NOT NULL DEFAULT 'Intermediate',
      preferred_language TEXT NOT NULL DEFAULT 'English',
      availability TEXT NOT NULL DEFAULT 'Evenings & Weekends',
      gaming_style TEXT NOT NULL DEFAULT 'Competitive Teamplay',
      bio TEXT NOT NULL DEFAULT '',
      favorite_games TEXT NOT NULL DEFAULT '[]',
      achievements TEXT NOT NULL DEFAULT '[]',
      wins INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      blocked_user_ids TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      genre TEXT NOT NULL,
      platforms TEXT NOT NULL,
      region_servers TEXT NOT NULL,
      active_players_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      game_title TEXT NOT NULL,
      captain_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      region TEXT NOT NULL,
      recruiting INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'Member',
      joined_at TEXT NOT NULL,
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS team_invitations (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      game_title TEXT NOT NULL,
      role_needed TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      game_title TEXT NOT NULL,
      organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      region TEXT NOT NULL,
      format TEXT NOT NULL,
      prize_pool TEXT NOT NULL,
      max_participants INTEGER NOT NULL,
      registration_deadline TEXT NOT NULL,
      start_date TEXT NOT NULL,
      schedule_summary TEXT NOT NULL,
      rules_summary TEXT NOT NULL,
      results_summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'open', 'ongoing', 'completed', 'rejected')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tournament_registrations (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_name TEXT NOT NULL DEFAULT '',
      in_game_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist')),
      created_at TEXT NOT NULL,
      UNIQUE (tournament_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      game_focus TEXT NOT NULL,
      region TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      club_type TEXT NOT NULL DEFAULT 'Gaming Club',
      description TEXT NOT NULL,
      rules TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_memberships (
      community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'owner')),
      joined_at TEXT NOT NULL,
      PRIMARY KEY (community_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY,
      community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_type TEXT NOT NULL DEFAULT 'announcement' CHECK (post_type IN ('announcement', 'activity', 'discussion')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      event_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link_view TEXT NOT NULL DEFAULT 'dashboard',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('user', 'community', 'post', 'tournament')),
      target_id TEXT NOT NULL,
      target_label TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'action_taken')),
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      org_type TEXT NOT NULL CHECK (org_type IN ('sponsor', 'club', 'organizer', 'academy')),
      country TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      verified_status TEXT NOT NULL DEFAULT 'pending' CHECK (verified_status IN ('pending', 'verified', 'rejected')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sponsorship_opportunities (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('sponsorship', 'club', 'event', 'career', 'equipment')),
      region TEXT NOT NULL,
      deadline TEXT NOT NULL,
      description TEXT NOT NULL,
      requirements TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunity_applications (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL REFERENCES sponsorship_opportunities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pitch TEXT NOT NULL,
      portfolio_link TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at TEXT NOT NULL,
      UNIQUE (opportunity_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS connection_tests (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      region_node TEXT NOT NULL,
      download_mbps REAL NOT NULL,
      upload_mbps REAL NOT NULL,
      ping_ms REAL NOT NULL,
      jitter_ms REAL NOT NULL,
      stability TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export function seedDatabase(): void {
  const existingCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (existingCount > 0) return;

  const now = new Date().toISOString();

  const insertUser = db.prepare(
    `INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)`
  );
  const insertProfile = db.prepare(
    `INSERT INTO profiles (
      user_id, full_name, username, avatar_url, country, city, gaming_platform,
      experience_level, preferred_language, availability, gaming_style, bio,
      favorite_games, achievements, wins, matches_played, blocked_user_ids, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`
  );

  const usersSeed = [
    {
      id: 'usr_dawit',
      email: 'dawit@gamebridge.et',
      pass: 'Gamer123!',
      role: 'gamer',
      fullName: 'Dawit Mekonnen',
      username: 'dawit_addis',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      platform: 'PC',
      exp: 'Competitive',
      lang: 'Amharic & English',
      avail: 'Weekday Evenings (19:00–23:00 EAT)',
      style: 'Aggressive Duelist / Entry Fragger',
      bio: 'Bole-based Valorant & EA FC competitor building an East African LAN-ready roster.',
      games: ['Valorant', 'EA FC 25', 'Counter-Strike 2'],
      achievements: ['Addis Invitational Quarterfinalist 2026', 'Bole LAN Cup Top 4'],
      wins: 28,
      matches: 42,
    },
    {
      id: 'usr_selam',
      email: 'selam@abyssiniaesports.et',
      pass: 'Organizer123!',
      role: 'organizer',
      fullName: 'Selamawit Tadesse',
      username: 'selam_abyssinia',
      country: 'Ethiopia',
      city: 'Hawassa',
      platform: 'PC & Console',
      exp: 'Pro',
      lang: 'Amharic & English',
      avail: 'Weekends & Evening Scrims',
      style: 'IGL / Tournament Director',
      bio: 'Tournament director at Abyssinia Esports League connecting university clubs across Ethiopia.',
      games: ['Valorant', 'EA FC 25', 'Tekken 8'],
      achievements: ['Organized Hawassa University Cup (128 Players)', 'Verified Tournament Host'],
      wins: 41,
      matches: 58,
    },
    {
      id: 'usr_admin',
      email: 'admin@gamebridge.et',
      pass: 'Admin123!',
      role: 'admin',
      fullName: 'Yonas Kebede',
      username: 'gamebridge_admin',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      platform: 'PC',
      exp: 'Pro',
      lang: 'Amharic & English',
      avail: 'Daily Operations',
      style: 'Ecosystem Moderator & Strategist',
      bio: 'Platform operations lead ensuring fair play, verified sponsors, and community safety.',
      games: ['Counter-Strike 2', 'Dota 2', 'Valorant'],
      achievements: ['GameBridge Operations Lead'],
      wins: 19,
      matches: 27,
    },
    {
      id: 'usr_bereket',
      email: 'bereket@gamebridge.et',
      pass: 'Gamer123!',
      role: 'gamer',
      fullName: 'Bereket Haile',
      username: 'bereket_fc',
      country: 'Ethiopia',
      city: 'Adama',
      platform: 'PlayStation 5',
      exp: 'Competitive',
      lang: 'Amharic & Afaan Oromo',
      avail: 'Evenings & Weekends',
      style: 'Possession & Counter Pressing',
      bio: 'PS5 EA FC 25 & Tekken 8 specialist representing Adama gaming lounges.',
      games: ['EA FC 25', 'Tekken 8'],
      achievements: ['Adama Console Series Champion', 'Ethiopia National Qualifier Seed #6'],
      wins: 34,
      matches: 49,
    },
    {
      id: 'usr_hana',
      email: 'hana@gamebridge.et',
      pass: 'Gamer123!',
      role: 'gamer',
      fullName: 'Hana Girma',
      username: 'hana_pubgm',
      country: 'Ethiopia',
      city: 'Bahir Dar',
      platform: 'Mobile',
      exp: 'Competitive',
      lang: 'Amharic & English',
      avail: 'Daily Nights (20:00–23:30 EAT)',
      style: 'Support / Zone Rotations',
      bio: 'PUBG Mobile IGL looking for disciplined East African squadmates for regional scrims.',
      games: ['PUBG Mobile', 'Valorant'],
      achievements: ['Lake Tana Mobile Cup Runner-Up', 'Women in Ethiopian Esports Captain'],
      wins: 25,
      matches: 39,
    },
    {
      id: 'usr_amina',
      email: 'amina@gamebridge.ke',
      pass: 'Gamer123!',
      role: 'gamer',
      fullName: 'Amina Ochieng',
      username: 'amina_nairobi',
      country: 'Kenya',
      city: 'Nairobi',
      platform: 'PC',
      exp: 'Pro',
      lang: 'English & Swahili',
      avail: 'Weekday Evenings',
      style: 'Tactical Controller / Support',
      bio: 'East Africa Valorant controller seeking cross-border scrim partners in Addis and Kampala.',
      games: ['Valorant', 'Counter-Strike 2', 'Dota 2'],
      achievements: ['Nairobi Masters Top 2', 'East Africa Cross-Border Scrim Host'],
      wins: 52,
      matches: 71,
    },
    {
      id: 'usr_kofi',
      email: 'kofi@gamebridge.ng',
      pass: 'Gamer123!',
      role: 'gamer',
      fullName: 'Chidi Nwosu',
      username: 'chidi_lagos',
      country: 'Nigeria',
      city: 'Lagos',
      platform: 'PlayStation 5',
      exp: 'Pro',
      lang: 'English',
      avail: 'Weekends',
      style: 'Frame-Trap Rushdown',
      bio: 'Pan-African Tekken 8 and EA FC competitor active in online coaching and sparring.',
      games: ['Tekken 8', 'EA FC 25'],
      achievements: ['West Africa Fighting Series Winner'],
      wins: 63,
      matches: 82,
    },
    {
      id: 'usr_samuel',
      email: 'samuel@gamebridge.et',
      pass: 'Gamer123!',
      role: 'gamer',
      fullName: 'Samuel Tesfaye',
      username: 'sam_mekelle',
      country: 'Ethiopia',
      city: 'Mekelle',
      platform: 'PC',
      exp: 'Intermediate',
      lang: 'Tigrinya, Amharic & English',
      avail: 'Weekends',
      style: 'Mid-Lane Playmaker',
      bio: 'Dota 2 and CS2 player connecting university players across northern Ethiopia.',
      games: ['Dota 2', 'Counter-Strike 2'],
      achievements: ['Campus Stack MVP'],
      wins: 14,
      matches: 26,
    },
  ];

  for (const u of usersSeed) {
    insertUser.run(u.id, u.email, hashPassword(u.pass), u.role, now);
    insertProfile.run(
      u.id,
      u.fullName,
      u.username,
      '',
      u.country,
      u.city,
      u.platform,
      u.exp,
      u.lang,
      u.avail,
      u.style,
      u.bio,
      JSON.stringify(u.games),
      JSON.stringify(u.achievements),
      u.wins,
      u.matches,
      now
    );
  }

  const insertGame = db.prepare(
    `INSERT INTO games (id, slug, title, genre, platforms, region_servers, active_players_count) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const gamesSeed = [
    ['g_val', 'valorant', 'Valorant', 'Tactical FPS', JSON.stringify(['PC', 'Console']), 'Bahrain · Dubai · Frankfurt', 480],
    ['g_eafc', 'ea-fc-25', 'EA FC 25', 'Football Simulation', JSON.stringify(['PlayStation 5', 'Xbox', 'PC']), 'Cross-Region / LAN Ethiopia', 720],
    ['g_pubgm', 'pubg-mobile', 'PUBG Mobile', 'Battle Royale', JSON.stringify(['Mobile']), 'Middle East · Africa Relay', 950],
    ['g_cs2', 'counter-strike-2', 'Counter-Strike 2', 'Tactical FPS', JSON.stringify(['PC']), 'Dubai · Frankfurt · Vienna', 310],
    ['g_tekken', 'tekken-8', 'Tekken 8', 'Fighting', JSON.stringify(['PlayStation 5', 'PC']), 'Peer-to-Peer / Local LAN', 215],
    ['g_dota2', 'dota-2', 'Dota 2', 'MOBA', JSON.stringify(['PC']), 'Dubai · EU East · EU West', 190],
  ];
  for (const g of gamesSeed) insertGame.run(...g);

  db.prepare(
    `INSERT INTO teams (id, name, tag, game_title, captain_id, region, recruiting, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run('team_addis_vanguard', 'Addis Vanguard', 'ADV', 'Valorant', 'usr_dawit', 'Ethiopia / East Africa', now);
  db.prepare(`INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'Captain', ?)`).run(
    'team_addis_vanguard',
    'usr_dawit',
    now
  );

  db.prepare(
    `INSERT INTO team_invitations (id, sender_id, receiver_id, team_id, game_title, role_needed, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    'inv_seed_1',
    'usr_amina',
    'usr_dawit',
    null,
    'Valorant',
    'Entry Duelist',
    'We are running East Africa Bahrain-server scrims this Friday at 20:00 EAT. Want to trial with our squad?',
    now
  );

  const insertTourney = db.prepare(
    `INSERT INTO tournaments (
      id, title, game_title, organizer_id, region, format, prize_pool, max_participants,
      registration_deadline, start_date, schedule_summary, rules_summary, results_summary, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertTourney.run(
    'trn_addis_eafc',
    'Ethiopian National EA FC 25 Open Cup',
    'EA FC 25',
    'usr_selam',
    'Ethiopia (Online + Addis LAN Finals)',
    '1v1 Double Elimination',
    '150,000 ETB + Pro Controller Kit',
    64,
    '2026-12-10T23:59:00Z',
    '2026-12-14T15:00:00Z',
    'Qualifiers Dec 14–15 (Online) · Top 8 LAN Finals Dec 21 at Bole Arena, Addis Ababa.',
    '6-minute halves, Tactical Defending required, Ethernet strongly recommended for online rounds.',
    '',
    'open',
    now
  );
  insertTourney.run(
    'trn_val_horn',
    'Horn of Africa Valorant Masters',
    'Valorant',
    'usr_selam',
    'East Africa (Bahrain / Dubai Server)',
    '5v5 Single Elimination BO3',
    '220,000 ETB + Bootcamp Passes',
    16,
    '2026-12-18T23:59:00Z',
    '2026-12-22T17:00:00Z',
    'Group Stage Dec 22–24 · Semifinals & Grand Final Dec 28 (18:00 EAT).',
    'Standard VCT map pool, max 120ms server cap check, anti-cheat required.',
    '',
    'open',
    now
  );
  insertTourney.run(
    'trn_pubgm_east',
    'East Africa Mobile Showdown: Squads',
    'PUBG Mobile',
    'usr_selam',
    'Ethiopia & Kenya (ME Relay)',
    '4-Player Squads · 6 Maps',
    '100,000 ETB Prize Pool',
    32,
    '2026-12-05T23:59:00Z',
    '2026-12-08T18:00:00Z',
    'Erangel, Miramar, Sanhok rotation over 2 matchdays starting 18:00 EAT.',
    'Mobile devices only (no emulators). Roster lock 24h before drop.',
    '',
    'open',
    now
  );
  insertTourney.run(
    'trn_hawassa_tekken',
    'Hawassa Tekken 8 Iron Fist Invitational',
    'Tekken 8',
    'usr_selam',
    'Hawassa & Addis Ababa',
    '1v1 FT3 Brackets',
    '45,000 ETB',
    32,
    '2026-10-15T23:59:00Z',
    '2026-10-20T14:00:00Z',
    'Completed October 2026 at Hawassa Hub.',
    'Standard TWT ruleset, loser may switch character.',
    '1st: bereket_fc (Adama) · 2nd: chidi_lagos · 3rd: dawit_addis',
    'completed',
    now
  );
  insertTourney.run(
    'trn_pending_cs2',
    'Adama University CS2 Winter Qualifier',
    'Counter-Strike 2',
    'usr_samuel',
    'Ethiopia (University Circuit)',
    '5v5 MR12',
    '60,000 ETB + Fiber Hub Hours',
    16,
    '2026-12-28T23:59:00Z',
    '2027-01-04T16:00:00Z',
    'Weekend campus qualifier starting Jan 4, 2027.',
    'Valid university student ID required for finals verification.',
    '',
    'pending_approval',
    now
  );

  db.prepare(
    `INSERT INTO tournament_registrations (id, tournament_id, user_id, team_name, in_game_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'confirmed', ?)`
  ).run('reg_seed_1', 'trn_addis_eafc', 'usr_bereket', 'Adama Strikers', 'BereketFC#ET', now);

  const insertComm = db.prepare(
    `INSERT INTO communities (id, name, slug, game_focus, region, city, club_type, description, rules, owner_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  );
  const insertMem = db.prepare(
    `INSERT INTO community_memberships (community_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`
  );
  const insertPost = db.prepare(
    `INSERT INTO community_posts (id, community_id, author_id, post_type, title, content, event_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertComm.run(
    'comm_addis_fps',
    'Addis Tactical FPS Club',
    'addis-tactical-fps',
    'Valorant & CS2',
    'Ethiopia',
    'Addis Ababa',
    'Competitive Club',
    'Organized Valorant and CS2 players in Addis Ababa hosting nightly 10-man customs, VOD reviews, and Bahrain-server scrim coordination.',
    'Respectful comms, zero toxicity or smurfing, report ping issues before match start.',
    'usr_dawit',
    now
  );
  insertComm.run(
    'comm_et_eafc',
    'Ethiopia EA FC Federation',
    'ethiopia-ea-fc',
    'EA FC 25',
    'Ethiopia',
    'Addis Ababa & Adama',
    'League Community',
    'Home of competitive console and PC football players across Ethiopia with weekly ranked ladders and LAN lounge meetups.',
    'Submit match screenshots within 15 minutes of full time.',
    'usr_bereket',
    now
  );
  insertComm.run(
    'comm_women_esports',
    'Women in Ethiopian Esports',
    'women-ethiopian-esports',
    'Multi-Game',
    'Ethiopia & East Africa',
    'Bahir Dar & Addis Ababa',
    'Mentorship & Community',
    'Building a welcoming space for women competing, streaming, shoutingcasting, and managing teams across the Horn of Africa.',
    'Zero tolerance for harassment. Support emerging players and casters.',
    'usr_hana',
    now
  );
  insertComm.run(
    'comm_hawassa_hub',
    'Hawassa University Gaming Guild',
    'hawassa-gaming-guild',
    'Tekken 8 & Dota 2',
    'Ethiopia',
    'Hawassa',
    'Campus Club',
    'Student-led gaming club organizing weekend fighting game brackets, MOBA workshops, and equipment sharing.',
    'Open to all regional students and alumni.',
    'usr_selam',
    now
  );

  insertMem.run('comm_addis_fps', 'usr_dawit', 'owner', now);
  insertMem.run('comm_addis_fps', 'usr_amina', 'member', now);
  insertMem.run('comm_et_eafc', 'usr_bereket', 'owner', now);
  insertMem.run('comm_et_eafc', 'usr_dawit', 'member', now);
  insertMem.run('comm_women_esports', 'usr_hana', 'owner', now);
  insertMem.run('comm_women_esports', 'usr_selam', 'moderator', now);
  insertMem.run('comm_hawassa_hub', 'usr_selam', 'owner', now);

  insertPost.run(
    'post_1',
    'comm_addis_fps',
    'usr_dawit',
    'announcement',
    'Friday Night 5v5 Customs & Ping Routing Test',
    'We are testing low-jitter routing to Bahrain servers tonight at 20:00 EAT. Join the club roster to claim a slot.',
    '2026-11-20T20:00:00Z',
    now
  );
  insertPost.run(
    'post_2',
    'comm_women_esports',
    'usr_hana',
    'activity',
    'Shoutcasting & Broadcast Production Workshop',
    'Sunday session covering observer camera basics, tournament brackets, and entry-level esports media careers.',
    '2026-11-22T16:00:00Z',
    now
  );

  const insertOrg = db.prepare(
    `INSERT INTO organizations (id, owner_id, name, org_type, country, city, website, description, verified_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertOrg.run(
    'org_abyssinia',
    'usr_selam',
    'Abyssinia Esports Collective',
    'organizer',
    'Ethiopia',
    'Addis Ababa & Hawassa',
    'https://abyssiniaesports.et',
    'National tournament organizer and university esports league operator in Ethiopia.',
    'verified',
    now
  );
  insertOrg.run(
    'org_bole_hub',
    'usr_admin',
    'Bole Fiber Gaming Arena',
    'club',
    'Ethiopia',
    'Addis Ababa',
    'https://bolegaming.et',
    'Dedicated 40-station 144Hz PC & PS5 esports training lounge with redundant enterprise fiber.',
    'verified',
    now
  );
  insertOrg.run(
    'org_horn_telco',
    'usr_admin',
    'EthioTech Youth Innovation Fund',
    'sponsor',
    'Ethiopia',
    'Addis Ababa',
    'https://ethiotech.example.et',
    'Sponsoring grass-roots digital talent, university tournaments, and peripheral grants.',
    'verified',
    now
  );
  insertOrg.run(
    'org_adama_academy',
    'usr_bereket',
    'Adama Console Academy',
    'academy',
    'Ethiopia',
    'Adama',
    'https://adamaacademy.et',
    'Console training club awaiting platform verification.',
    'pending',
    now
  );

  const insertOpp = db.prepare(
    `INSERT INTO sponsorship_opportunities (id, org_id, title, category, region, deadline, description, requirements, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  );
  insertOpp.run(
    'opp_1',
    'org_horn_telco',
    '2026 Ethiopian Rising Roster Micro-Sponsorship',
    'sponsorship',
    'Ethiopia',
    '2026-12-30',
    'Covers tournament entry fees, team jerseys, and 6 months of fiber hub training hours for two active Ethiopian squads.',
    'Active 5-player roster with GameBridge match history and clean moderation standing.',
    now
  );
  insertOpp.run(
    'opp_2',
    'org_bole_hub',
    'Free Bootcamp Rig Access for Qualifier Finalists',
    'equipment',
    'Addis Ababa',
    '2026-12-20',
    'Provides 144Hz monitors, pro headsets, mechanical keyboards, and low-jitter wired fiber stations for teams without home PCs.',
    'Registered team in an active GameBridge tournament or verified club recommendation.',
    now
  );
  insertOpp.run(
    'opp_3',
    'org_abyssinia',
    'Esports Career Track: Broadcast Observer & Referee Fellowship',
    'career',
    'Ethiopia & Remote',
    '2027-01-15',
    'Hands-on training in tournament administration, live bracket operations, and English/Amharic esports commentary.',
    'Strong game knowledge in Valorant, EA FC, or PUBG Mobile; no prior broadcast gear needed.',
    now
  );
  insertOpp.run(
    'opp_4',
    'org_bole_hub',
    'Addis Tech & Gaming Expo — Collegiate Showcase',
    'event',
    'Addis Ababa',
    '2026-12-12',
    'Annual showcase connecting local game developers, hardware vendors, university clubs, and regional esports sponsors.',
    'Open to players, club founders, and student organizers.',
    now
  );

  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, link_view, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(
    'notif_1',
    'usr_dawit',
    'New Team Invitation from amina_nairobi',
    'You were invited to join East Africa Bahrain-server Valorant scrims.',
    'players',
    now
  );
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, link_view, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(
    'notif_2',
    'usr_dawit',
    'Ethiopian National EA FC 25 Open Cup is Open',
    'Registration closes December 10. Verify your connection before qualifiers.',
    'tournaments',
    now
  );

  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, target_label, reason, details, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    'rep_seed_1',
    'usr_hana',
    'post',
    'post_1',
    'External Unverified Discord Link Check',
    'Spam / Unverified External Link',
    'Flagged for moderator review to verify tournament organizer authenticity.',
    now
  );

  db.prepare(
    `INSERT INTO connection_tests (id, user_id, region_node, download_mbps, upload_mbps, ping_ms, jitter_ms, stability, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('conn_seed_1', 'usr_dawit', 'Addis Ababa Fiber Relay', 38.4, 16.2, 42, 6.5, 'Excellent', now);
}

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
