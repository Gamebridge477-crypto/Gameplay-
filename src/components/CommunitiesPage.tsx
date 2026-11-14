import React, { useCallback, useEffect, useState } from 'react';
import { Flag, Plus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';
import type { Community, CommunityPost } from '../shared/types';

export function CommunitiesPage() {
  const { user, navigate } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ community: Community; posts: CommunityPost[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState('');
  const [cGame, setCGame] = useState('Valorant');
  const [cCity, setCCity] = useState('Addis Ababa');
  const [cType, setCType] = useState('Gaming Club');
  const [cDesc, setCDesc] = useState('');

  // New announcement/activity form
  const [postType, setPostType] = useState<'announcement' | 'activity' | 'discussion'>('announcement');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');

  // Report modal
  const [reportTarget, setReportTarget] = useState<{ type: 'community' | 'post'; id: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState('Harassment or Toxicity');
  const [reportDetails, setReportDetails] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ communities: Community[] }>('/api/communities');
      setCommunities(data.communities);
      if (data.communities.length > 0 && !selectedId) {
        setSelectedId(data.communities[0].id);
      }
    } catch {
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const data = await apiRequest<{ community: Community; posts: CommunityPost[] }>(`/api/communities/${id}`);
      setDetail(data);
    } catch {
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const handleJoinToggle = async (communityId: string) => {
    if (!user) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ isMember: boolean }>(`/api/communities/${communityId}/join`, {
        method: 'POST',
      });
      setFeedback(res.isMember ? 'Joined community.' : 'Left community.');
      await loadCommunities();
      if (selectedId === communityId) await loadDetail(communityId);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to update membership.');
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ id: string }>('/api/communities', {
        method: 'POST',
        body: JSON.stringify({
          name: cName,
          gameFocus: cGame,
          region: 'Ethiopia',
          city: cCity,
          clubType: cType,
          description: cDesc,
        }),
      });
      setFeedback(`Community "${cName}" created.`);
      setShowCreate(false);
      setCName('');
      setCDesc('');
      setSelectedId(res.id);
      loadCommunities();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Could not create community.');
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !detail) return;
    setErrorMsg(null);
    try {
      await apiRequest(`/api/communities/${detail.community.id}/posts`, {
        method: 'POST',
        body: JSON.stringify({ postType, title: postTitle, content: postContent }),
      });
      setPostTitle('');
      setPostContent('');
      setFeedback('Community post published.');
      loadDetail(detail.community.id);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Could not publish post.');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportTarget) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    try {
      await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: reportTarget.type,
          targetId: reportTarget.id,
          targetLabel: reportTarget.label,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      setFeedback('Report submitted to GameBridge moderators.');
      setReportTarget(null);
      setReportDetails('');
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Could not submit report.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Gaming Clubs & Local Hubs</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
            Gaming Communities
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Join city clubs and university guilds, share announcements, organize scrims, and help keep spaces safe.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!user) navigate('auth', { authMode: 'login' });
            else setShowCreate((p) => !p);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[40px] shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Community</span>
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreateCommunity} className="rounded-xl border border-slate-700 bg-[#0B1120] p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">Launch a New Gaming Community</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="Club Name (e.g. Bahir Dar Esports)"
              className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              required
              value={cGame}
              onChange={(e) => setCGame(e.target.value)}
              placeholder="Game Focus (e.g. Valorant)"
              className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={cCity}
              onChange={(e) => setCCity(e.target.value)}
              placeholder="City (e.g. Bahir Dar)"
              className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <select
              value={cType}
              onChange={(e) => setCType(e.target.value)}
              className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            >
              <option value="Gaming Club">Gaming Club</option>
              <option value="Campus Club">Campus Club</option>
              <option value="Competitive Guild">Competitive Guild</option>
              <option value="LAN Lounge Community">LAN Lounge Community</option>
            </select>
          </div>
          <textarea
            rows={2}
            required
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
            placeholder="Describe your club's focus, scrim schedule, and goals..."
            className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-semibold text-white">
              Create Club
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Communities List */}
        <div className="lg:col-span-5 space-y-3">
          {loading ? (
            <div className="h-64 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
          ) : (
            communities.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border p-4 transition-colors ${
                  selectedId === c.id ? 'border-blue-500 bg-[#0F172A]' : 'border-slate-800 bg-[#0B1120]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="text-left flex-1"
                  >
                    <p className="text-xs text-blue-400 font-medium">{c.gameFocus} · {c.clubType}</p>
                    <h2 className="mt-1 font-display text-base font-semibold text-white">{c.name}</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {c.city ? `${c.city}, ` : ''}{c.region} · <span className="font-mono tabular-nums">{c.memberCount}</span> members
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJoinToggle(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 min-h-[34px] ${
                      c.isMember
                        ? 'border border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {c.isMember ? 'Joined' : 'Join'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Community Feed & Info */}
        <div className="lg:col-span-7">
          {!detail ? (
            <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-8 text-center text-xs text-slate-400">
              Select a community to view announcements and team activities.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <p className="text-xs text-slate-400">
                    {detail.community.clubType} · Founded by @{detail.community.ownerUsername}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-white">{detail.community.name}</h2>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">{detail.community.description}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Club Rules: {detail.community.rules}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!user) navigate('auth', { authMode: 'login' });
                    else
                      setReportTarget({
                        type: 'community',
                        id: detail.community.id,
                        label: detail.community.name,
                      });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-rose-500/50 text-xs text-slate-400 hover:text-rose-300"
                >
                  <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Report Club</span>
                </button>
              </div>

              {/* Post Announcement / Activity */}
              {detail.community.isMember && (
                <form onSubmit={handleCreatePost} className="rounded-lg border border-slate-800 bg-[#070B16] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white">Share Announcement or Team Activity</p>
                    <select
                      aria-label="Post type"
                      value={postType}
                      onChange={(e) => setPostType(e.target.value as any)}
                      className="rounded-md border border-slate-700 bg-[#060A14] px-2.5 py-1 text-xs text-white"
                    >
                      <option value="announcement">Announcement</option>
                      <option value="activity">Team Activity / Scrim</option>
                      <option value="discussion">Discussion</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    required
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="Title (e.g. Saturday 5v5 Custom Scrims)"
                    className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                  />
                  <textarea
                    rows={2}
                    required
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Share details, time (EAT), and roster slots..."
                    className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                  >
                    Publish Post
                  </button>
                </form>
              )}

              {/* Posts Feed */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                  <span>Club Feed & Team Activities</span>
                </p>
                {detail.posts.length === 0 ? (
                  <p className="text-xs text-slate-400">No announcements yet.</p>
                ) : (
                  detail.posts.map((post) => (
                    <div key={post.id} className="rounded-lg border border-slate-800 bg-[#070B16] p-4">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span>
                          <span className="capitalize text-blue-400 font-medium">{post.postType}</span> · @{post.authorUsername}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!user) navigate('auth', { authMode: 'login' });
                            else setReportTarget({ type: 'post', id: post.id, label: post.title });
                          }}
                          className="text-slate-500 hover:text-rose-300"
                        >
                          Report
                        </button>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-white">{post.title}</h3>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">{post.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {reportTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitReport} className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0B1120] p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">
              Report: {reportTarget.label}
            </h2>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Reason</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              >
                <option value="Harassment or Toxicity">Harassment or Toxicity</option>
                <option value="Spam / Unverified Links">Spam / Unverified Links</option>
                <option value="Cheating / Match Fixing">Cheating / Match Fixing</option>
                <option value="Inappropriate Content">Inappropriate Content</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Details</label>
              <textarea
                rows={3}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Provide context for platform moderators..."
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReportTarget(null)} className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white">
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
