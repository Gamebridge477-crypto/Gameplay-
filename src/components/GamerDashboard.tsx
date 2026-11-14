import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bell, Check, Trophy, Users, Wifi } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { Community, NotificationItem, PublicProfile, Tournament } from '../shared/types';

interface DashboardData {
  recommendedTeammates: {
    profile: PublicProfile;
    score: number;
    reasons: string[];
  }[];
  upcomingTournaments: Tournament[];
  communities: Community[];
  notifications: NotificationItem[];
  recentPosts: {
    id: string;
    title: string;
    postType: string;
    createdAt: string;
    communityName: string;
    authorUsername: string;
  }[];
  gamingStats: {
    wins: number;
    matchesPlayed: number;
    winRate: number;
    tournamentsJoined: number;
    communitiesJoined: number;
    pendingInvites: number;
  };
}

export function GamerDashboard() {
  const { user, navigate } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<DashboardData>('/api/dashboard');
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, loadDashboard]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Sign in to open your Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Track tournaments, recommended teammates, notifications, and gaming stats.
        </p>
        <button
          type="button"
          onClick={() => navigate('auth', { authMode: 'login' })}
          className="mt-6 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white"
        >
          Log In or Sign Up
        </button>
      </div>
    );
  }

  const quickInvite = async (candidate: PublicProfile) => {
    try {
      await apiRequest('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: candidate.userId,
          gameTitle: candidate.favoriteGames[0] || user.favoriteGames[0] || 'Valorant',
          roleNeeded: 'Squad Teammate',
          message: `Hi @${candidate.username}, let's queue together via GameBridge!`,
        }),
      });
      setInvitedIds((prev) => [...prev, candidate.userId]);
      setFeedback(`Invitation sent to @${candidate.username}.`);
    } catch (err: any) {
      setFeedback(err?.message || 'Could not send invitation.');
    }
  };

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
    loadDashboard();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Header Welcome & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <p className="text-xs font-medium text-blue-400">Personalized Gamer Workspace</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
            Welcome back, {user.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            @{user.username} · {user.city ? `${user.city}, ` : ''}{user.country} · {user.gamingPlatform} · {user.favoriteGames.join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('connection')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-[#0B1120] hover:border-slate-500 text-xs font-semibold text-slate-100 min-h-[40px]"
          >
            <Wifi className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span>Check Latency</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('profile')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[40px]"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-blue-500/40 bg-blue-950/30 px-4 py-2.5 text-xs text-blue-200 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Gaming Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4">
          <p className="text-xs text-slate-400">Matches Won</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums">
            {data?.gamingStats.wins ?? user.wins}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4">
          <p className="text-xs text-slate-400">Matches Played</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums">
            {data?.gamingStats.matchesPlayed ?? user.matchesPlayed}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4">
          <p className="text-xs text-slate-400">Win Rate</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-blue-400 tabular-nums">
            {data?.gamingStats.winRate ?? 0}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4">
          <p className="text-xs text-slate-400">Tournaments</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums">
            {data?.gamingStats.tournamentsJoined ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4">
          <p className="text-xs text-slate-400">Communities</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums">
            {data?.gamingStats.communitiesJoined ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4">
          <p className="text-xs text-slate-400">Pending Invites</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-violet-400 tabular-nums">
            {data?.gamingStats.pendingInvites ?? 0}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left 8 Columns: Recommended Teammates & Upcoming Tournaments */}
          <div className="lg:col-span-8 space-y-8">
            {/* Recommended Teammates */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-lg font-semibold text-white">
                  Recommended Teammates
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('players')}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                >
                  <span>Browse All Players</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(data?.recommendedTeammates || []).map(({ profile, score, reasons }) => {
                  const invited = invitedIds.includes(profile.userId);
                  return (
                    <div
                      key={profile.userId}
                      className="rounded-xl border border-slate-800 bg-[#0B1120] p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => navigate('profile', { username: profile.username })}
                            className="font-semibold text-sm text-white hover:text-blue-400 text-left"
                          >
                            @{profile.username}
                          </button>
                          <span className="font-mono text-xs tabular-nums text-blue-400">
                            {score}% match
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {profile.city ? `${profile.city}, ` : ''}{profile.country} · {profile.gamingPlatform}
                        </p>
                        <p className="mt-2 text-xs text-slate-300">
                          {profile.favoriteGames.join(', ')}
                        </p>
                        {reasons.length > 0 && (
                          <p className="mt-1.5 text-[11px] text-slate-400">
                            {reasons.slice(0, 2).join(' · ')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={invited}
                        onClick={() => quickInvite(profile)}
                        className={`mt-4 w-full py-2 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                          invited
                            ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                            : 'bg-slate-800 hover:bg-blue-600 text-white'
                        }`}
                      >
                        {invited ? 'Invitation Sent' : 'Send Team Invite'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Upcoming Tournaments */}
            <section className="rounded-xl border border-slate-800 bg-[#0B1120] p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-blue-400" aria-hidden="true" />
                  <span>Upcoming Tournaments</span>
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('tournaments')}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                >
                  <span>All Tournaments</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="divide-y divide-slate-800/80">
                {(data?.upcomingTournaments || []).map((t) => (
                  <div key={t.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{t.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.gameTitle} · {t.prizePool} · Starts {new Date(t.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono tabular-nums text-slate-300">
                        {t.registeredCount}/{t.maxParticipants}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('tournaments')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] ${
                          t.isRegistered
                            ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {t.isRegistered ? 'Registered' : 'Details'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Popular Communities */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-400" aria-hidden="true" />
                  <span>Popular Communities</span>
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('communities')}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  Explore All
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(data?.communities || []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate('communities')}
                    className="text-left rounded-xl border border-slate-800 bg-[#0B1120] p-4 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                      {c.isMember && (
                        <span className="text-[11px] font-medium text-emerald-400">Joined</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {c.gameFocus} · {c.memberCount} members
                    </p>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Right 4 Columns: Notifications & Recent Activities */}
          <div className="lg:col-span-4 space-y-6">
            <section className="rounded-xl border border-slate-800 bg-[#0B1120] p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400" aria-hidden="true" />
                  <span>Notifications</span>
                </h2>
                {(data?.notifications || []).some((n) => !n.isRead) && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Mark Read</span>
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-800/80">
                {(data?.notifications || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No notifications yet.</p>
                ) : (
                  (data?.notifications || []).map((n) => (
                    <div
                      key={n.id}
                      className="py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white">{n.title}</p>
                        {!n.isRead && (
                          <span className="text-[10px] font-medium text-blue-400 shrink-0">Unread</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-[#0B1120] p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">
                Recent Community Activity
              </h2>
              <div className="divide-y divide-slate-800/80">
                {(data?.recentPosts || []).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => navigate('communities')}
                    className="block w-full text-left py-3 first:pt-0 last:pb-0 hover:text-blue-400 transition-colors"
                  >
                    <p className="text-xs font-semibold text-white">{post.title}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {post.communityName} · @{post.authorUsername}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
