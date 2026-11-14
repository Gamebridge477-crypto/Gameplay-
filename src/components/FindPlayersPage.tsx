import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Flag, Plus, Search, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';
import type { PublicProfile, Team, TeamInvitation } from '../shared/types';

interface MatchResult {
  profile: PublicProfile;
  score: number;
  reasons: string[];
}

export function FindPlayersPage() {
  const { user, navigate, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'players' | 'invitations' | 'teams'>('players');

  // Matchmaking filters
  const [search, setSearch] = useState('');
  const [game, setGame] = useState('All');
  const [platform, setPlatform] = useState('All');
  const [experienceLevel, setExperienceLevel] = useState('All');
  const [language, setLanguage] = useState('All');
  const [region, setRegion] = useState('All');
  const [availability, setAvailability] = useState('All');
  const [gamingStyle, setGamingStyle] = useState('All');

  const [players, setPlayers] = useState<MatchResult[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Invite modal state
  const [inviteTarget, setInviteTarget] = useState<PublicProfile | null>(null);
  const [inviteGame, setInviteGame] = useState('Valorant');
  const [inviteRole, setInviteRole] = useState('Entry / Flex');
  const [inviteMessage, setInviteMessage] = useState('');

  // Create team form state
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamTag, setTeamTag] = useState('');
  const [teamGame, setTeamGame] = useState('Valorant');
  const [teamRegion, setTeamRegion] = useState('Ethiopia');

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (game !== 'All') params.set('game', game);
    if (platform !== 'All') params.set('platform', platform);
    if (experienceLevel !== 'All') params.set('experienceLevel', experienceLevel);
    if (language !== 'All') params.set('language', language);
    if (region !== 'All') params.set('region', region);
    if (availability !== 'All') params.set('availability', availability);
    if (gamingStyle !== 'All') params.set('gamingStyle', gamingStyle);
    if (search.trim()) params.set('search', search.trim());

    try {
      const data = await apiRequest<{ players: MatchResult[] }>(`/api/players?${params.toString()}`);
      setPlayers(data.players);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [game, platform, experienceLevel, language, region, availability, gamingStyle, search]);

  const fetchInvitesAndTeams = useCallback(async () => {
    try {
      const tData = await apiRequest<{ teams: Team[] }>('/api/teams');
      setTeams(tData.teams);
      if (user) {
        const iData = await apiRequest<{ invitations: TeamInvitation[] }>('/api/invitations');
        setInvitations(iData.invitations);
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    fetchInvitesAndTeams();
  }, [fetchInvitesAndTeams]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    if (!inviteTarget) return;
    setErrorMsg(null);
    try {
      await apiRequest('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: inviteTarget.userId,
          gameTitle: inviteGame,
          roleNeeded: inviteRole,
          message: inviteMessage,
        }),
      });
      setStatusMsg(`Team invitation sent to @${inviteTarget.username}.`);
      setInviteTarget(null);
      setInviteMessage('');
      fetchInvitesAndTeams();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Failed to send invitation.');
    }
  };

  const handleRespondInvite = async (id: string, status: 'accepted' | 'declined') => {
    setErrorMsg(null);
    try {
      await apiRequest(`/api/invitations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setStatusMsg(`Invitation ${status}.`);
      fetchInvitesAndTeams();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Failed to update invitation.');
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    setErrorMsg(null);
    try {
      await apiRequest('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name: teamName, tag: teamTag, gameTitle: teamGame, region: teamRegion }),
      });
      setStatusMsg(`Team "${teamName}" created.`);
      setTeamName('');
      setTeamTag('');
      setShowCreateTeam(false);
      fetchInvitesAndTeams();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Could not create team.');
    }
  };

  const handleBlockPlayer = async (target: PublicProfile) => {
    if (!user) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    try {
      await apiRequest('/api/players/block', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: target.userId }),
      });
      setStatusMsg(`@${target.username} has been blocked and hidden from your matchmaking feed.`);
      await refreshUser();
      fetchPlayers();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Could not block user.');
    }
  };

  const handleReportPlayer = async (target: PublicProfile) => {
    if (!user) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    try {
      await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'user',
          targetId: target.userId,
          targetLabel: `@${target.username}`,
          reason: 'Inappropriate Conduct / Matchmaking Abuse',
          details: 'Flagged via Find Players directory for admin review.',
        }),
      });
      setStatusMsg(`Report submitted for @${target.username}. Moderators will review it.`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Report failed.');
    }
  };

  const pendingReceivedCount = invitations.filter(
    (inv) => user && inv.receiverId === user.userId && inv.status === 'pending'
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Regional Matchmaking Engine</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
            Find Players & Build Squads
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Filter teammates by game, platform, language, Ethiopian or African city, schedule, and playstyle.
          </p>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1120] border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('players')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'players' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Matchmaking ({players.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'invitations' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Invitations {pendingReceivedCount > 0 ? `(${pendingReceivedCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('teams')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'teams' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Teams ({teams.length})
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg(null)} className="text-slate-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {activeTab === 'players' && (
        <>
          {/* Filter Controls */}
          <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" aria-hidden="true" />
                <input
                  type="text"
                  aria-label="Search players by username, city, or playstyle"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search player, city, style..."
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none min-h-[40px]"
                />
              </div>

              <select
                aria-label="Filter by favorite game"
                value={game}
                onChange={(e) => setGame(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
              >
                <option value="All">All Games</option>
                <option value="Valorant">Valorant</option>
                <option value="EA FC 25">EA FC 25</option>
                <option value="PUBG Mobile">PUBG Mobile</option>
                <option value="Counter-Strike 2">Counter-Strike 2</option>
                <option value="Tekken 8">Tekken 8</option>
                <option value="Dota 2">Dota 2</option>
              </select>

              <select
                aria-label="Filter by gaming platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
              >
                <option value="All">All Platforms</option>
                <option value="PC">PC</option>
                <option value="PlayStation 5">PlayStation 5</option>
                <option value="Mobile">Mobile</option>
                <option value="PC & Console">PC & Console</option>
              </select>

              <select
                aria-label="Filter by experience level"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
              >
                <option value="All">All Experience Levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Competitive">Competitive</option>
                <option value="Pro">Pro</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                aria-label="Filter by preferred language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
              >
                <option value="All">All Languages</option>
                <option value="Amharic">Amharic</option>
                <option value="English">English</option>
                <option value="Afaan Oromo">Afaan Oromo</option>
                <option value="Tigrinya">Tigrinya</option>
                <option value="Swahili">Swahili</option>
              </select>

              <select
                aria-label="Filter by region or country"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
              >
                <option value="All">All Regions</option>
                <option value="Ethiopia">Ethiopia (All Cities)</option>
                <option value="Addis Ababa">Addis Ababa</option>
                <option value="Hawassa">Hawassa</option>
                <option value="Adama">Adama</option>
                <option value="Bahir Dar">Bahir Dar</option>
                <option value="Kenya">Kenya</option>
                <option value="Nigeria">Nigeria</option>
              </select>

              <select
                aria-label="Filter by availability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
              >
                <option value="All">Any Availability</option>
                <option value="Evenings">Evenings</option>
                <option value="Weekends">Weekends</option>
                <option value="Daily">Daily</option>
              </select>

              <select
                aria-label="Filter by gaming style"
                value={gamingStyle}
                onChange={(e) => setGamingStyle(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
              >
                <option value="All">Any Playstyle</option>
                <option value="Aggressive">Aggressive / Entry</option>
                <option value="IGL">IGL / Strategist</option>
                <option value="Support">Support / Controller</option>
                <option value="Possession">Possession / Tactical</option>
              </select>
            </div>
          </div>

          {/* Matchmaking Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
              ))}
            </div>
          ) : players.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-10 text-center">
              <p className="text-sm font-semibold text-white">No players match these filters</p>
              <p className="mt-1 text-xs text-slate-400">
                Try broadening your region or game filter to see more available teammates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {players.map(({ profile, score }) => (
                <div
                  key={profile.userId}
                  className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0B1120] p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => navigate('profile', { username: profile.username })}
                          className="font-display text-base font-semibold text-white hover:text-blue-400 text-left"
                        >
                          @{profile.username}
                        </button>
                        <p className="text-xs text-slate-400">
                          {profile.fullName} · {profile.city ? `${profile.city}, ` : ''}{profile.country}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold tabular-nums text-blue-400 shrink-0">
                        {score}% fit
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-300 border-t border-slate-800/70 pt-3">
                      <p>
                        <span className="text-slate-400">Games: </span>
                        {profile.favoriteGames.join(', ')}
                      </p>
                      <p>
                        <span className="text-slate-400">Platform & Tier: </span>
                        {profile.gamingPlatform} · {profile.experienceLevel}
                      </p>
                      <p>
                        <span className="text-slate-400">Style: </span>
                        {profile.gamingStyle}
                      </p>
                      <p>
                        <span className="text-slate-400">Languages: </span>
                        {profile.preferredLanguage}
                      </p>
                      <p>
                        <span className="text-slate-400">Available: </span>
                        {profile.availability}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/70 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          navigate('auth', { authMode: 'login' });
                          return;
                        }
                        setInviteTarget(profile);
                        setInviteGame(profile.favoriteGames[0] || 'Valorant');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[38px]"
                    >
                      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Invite</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Block ${profile.username}`}
                      onClick={() => handleBlockPlayer(profile)}
                      className="p-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 min-h-[38px] min-w-[38px] flex items-center justify-center"
                      title="Block player"
                    >
                      <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Report ${profile.username}`}
                      onClick={() => handleReportPlayer(profile)}
                      className="p-2 rounded-lg border border-slate-700 hover:border-rose-500/60 text-slate-400 hover:text-rose-300 min-h-[38px] min-w-[38px] flex items-center justify-center"
                      title="Report player"
                    >
                      <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'invitations' && (
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6">
          {!user ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-300">Log in to send, accept, or decline team invitations.</p>
              <button
                type="button"
                onClick={() => navigate('auth', { authMode: 'login' })}
                className="mt-4 px-5 py-2 rounded-lg bg-blue-600 text-xs font-semibold text-white"
              >
                Log In
              </button>
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-slate-400">No team invitations yet. Browse players to send your first invite.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {invitations.map((inv) => {
                const isReceiver = inv.receiverId === user.userId;
                return (
                  <div key={inv.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {isReceiver ? `From @${inv.senderUsername}` : `To @${inv.receiverUsername}`} · {inv.gameTitle} ({inv.roleNeeded})
                      </p>
                      {inv.message && <p className="mt-1 text-xs text-slate-300">{inv.message}</p>}
                      <p className="mt-1 text-[11px] text-slate-500">
                        Status: <span className="text-slate-300 capitalize">{inv.status}</span> · {new Date(inv.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isReceiver && inv.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRespondInvite(inv.id, 'accepted')}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[38px]"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondInvite(inv.id, 'declined')}
                          className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 min-h-[38px]"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!user) navigate('auth', { authMode: 'login' });
                else setShowCreateTeam((p) => !p);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[40px]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create Team</span>
            </button>
          </div>

          {showCreateTeam && (
            <form onSubmit={handleCreateTeam} className="rounded-xl border border-slate-800 bg-[#0B1120] p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Abyssinia Five"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Tag (3–5 chars)</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={teamTag}
                  onChange={(e) => setTeamTag(e.target.value)}
                  placeholder="ABY"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white uppercase"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Primary Game</label>
                <select
                  value={teamGame}
                  onChange={(e) => setTeamGame(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                >
                  <option value="Valorant">Valorant</option>
                  <option value="EA FC 25">EA FC 25</option>
                  <option value="PUBG Mobile">PUBG Mobile</option>
                  <option value="Counter-Strike 2">Counter-Strike 2</option>
                  <option value="Dota 2">Dota 2</option>
                </select>
              </div>
              <button
                type="submit"
                className="py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[38px]"
              >
                Save Team
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-800 bg-[#0B1120] p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-white">
                    [{t.tag}] {t.name}
                  </h3>
                  <Users className="w-4 h-4 text-blue-400" aria-hidden="true" />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {t.gameTitle} · {t.region}
                </p>
                <p className="mt-3 text-xs text-slate-300">
                  Captain: @{t.captainUsername} · <span className="font-mono tabular-nums">{t.memberCount}</span> member(s)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Invitation Modal */}
      {inviteTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleSendInvite}
            className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0B1120] p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-white">
              Invite @{inviteTarget.username}
            </h2>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Game</label>
              <input
                type="text"
                required
                value={inviteGame}
                onChange={(e) => setInviteGame(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Role Needed</label>
              <input
                type="text"
                required
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                placeholder="Controller / Support / Duo Partner"
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Message</label>
              <textarea
                rows={3}
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Share your server region, scrim time, or tournament goal..."
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInviteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                Send Invitation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
