import React, { useCallback, useEffect, useState } from 'react';
import { Award, Check, Edit3, Trophy, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';
import type { PublicProfile } from '../shared/types';

interface ProfileResponse {
  profile: PublicProfile;
  communities: { id: string; name: string; gameFocus: string; city: string; role: string }[];
  tournaments: { id: string; title: string; gameTitle: string; startDate: string; status: string; teamName: string }[];
}

const ALL_GAMES = ['Valorant', 'EA FC 25', 'PUBG Mobile', 'Counter-Strike 2', 'Tekken 8', 'Dota 2'];

export function ProfilePage() {
  const { user, selectedUsername, navigate, refreshUser } = useAuth();
  const targetUsername = selectedUsername || user?.username || null;

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [gamingPlatform, setGamingPlatform] = useState('PC');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [availability, setAvailability] = useState('');
  const [gamingStyle, setGamingStyle] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteGames, setFavoriteGames] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!targetUsername) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<ProfileResponse>(`/api/profile/${encodeURIComponent(targetUsername)}`);
      setData(res);
      setFullName(res.profile.fullName);
      setCountry(res.profile.country);
      setCity(res.profile.city);
      setGamingPlatform(res.profile.gamingPlatform);
      setExperienceLevel(res.profile.experienceLevel);
      setPreferredLanguage(res.profile.preferredLanguage);
      setAvailability(res.profile.availability);
      setGamingStyle(res.profile.gamingStyle);
      setBio(res.profile.bio);
      setFavoriteGames(res.profile.favoriteGames);
      setAvatarUrl(res.profile.avatarUrl);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [targetUsername]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (!targetUsername) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Sign in to view your Profile</h1>
        <button
          type="button"
          onClick={() => navigate('auth', { authMode: 'login' })}
          className="mt-5 px-5 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white"
        >
          Log In
        </button>
      </div>
    );
  }

  const isOwnProfile = Boolean(user && data?.profile.userId === user.userId);

  const toggleGame = (g: string) => {
    setFavoriteGames((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
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
        }),
      });
      setEditing(false);
      setFeedback('Profile updated.');
      await refreshUser();
      await loadProfile();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Update failed.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-64 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-slate-400">
        Player profile not found.
      </div>
    );
  }

  const p = data.profile;
  const initials = p.fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
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

      {/* Profile Header Card */}
      <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {p.avatarUrl ? (
            <img
              src={p.avatarUrl}
              alt={`${p.username} avatar`}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-xl object-cover border border-slate-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-600/30 to-violet-600/30 border border-blue-500/40 flex items-center justify-center font-display text-2xl font-bold text-white shrink-0">
              {initials}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <span className="capitalize">{p.role}</span>
              <span aria-hidden="true">·</span>
              <span>{p.experienceLevel}</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-white">{p.fullName}</h1>
            <p className="text-sm text-slate-300">
              @{p.username} · {p.city ? `${p.city}, ` : ''}{p.country}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {p.gamingPlatform} · {p.preferredLanguage} · {p.availability}
            </p>
          </div>
        </div>

        {isOwnProfile && (
          <button
            type="button"
            onClick={() => setEditing((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 hover:border-blue-500 text-xs font-semibold text-white shrink-0 min-h-[40px]"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{editing ? 'Cancel Edit' : 'Edit Profile'}</span>
          </button>
        )}
      </div>

      {/* Edit Form */}
      {editing && isOwnProfile && (
        <form onSubmit={handleSaveProfile} className="rounded-xl border border-blue-500/40 bg-[#0B1120] p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">Update Profile Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Country</label>
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Gaming Platform</label>
              <select
                value={gamingPlatform}
                onChange={(e) => setGamingPlatform(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              >
                <option value="PC">PC</option>
                <option value="PlayStation 5">PlayStation 5</option>
                <option value="Xbox Series">Xbox Series</option>
                <option value="Mobile">Mobile</option>
                <option value="PC & Console">PC & Console</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Competitive">Competitive</option>
                <option value="Pro">Pro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Preferred Languages</label>
              <input
                type="text"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Availability</label>
              <input
                type="text"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Gaming Style</label>
              <input
                type="text"
                value={gamingStyle}
                onChange={(e) => setGamingStyle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs text-slate-300 mb-1.5">Favorite Games</span>
            <div className="flex flex-wrap gap-2">
              {ALL_GAMES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGame(g)}
                  className={`px-3 py-1.5 rounded-lg border text-xs ${
                    favoriteGames.includes(g)
                      ? 'border-blue-500 bg-blue-600/20 text-white'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            <span>Save Changes</span>
          </button>
        </form>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">Player Overview</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {p.bio || 'No bio added yet.'}
          </p>
          <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
            <p><span className="text-slate-400">Favorite Games:</span> <span className="text-white">{p.favoriteGames.join(', ')}</span></p>
            <p><span className="text-slate-400">Playstyle:</span> <span className="text-white">{p.gamingStyle}</span></p>
            <p><span className="text-slate-400">Match Record:</span> <span className="font-mono tabular-nums text-white">{p.wins}W / {p.matchesPlayed}M</span></p>
          </div>
          {isOwnProfile && user && (
            <p className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
              Private account email ({user.email}) is hidden from other users.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-violet-400" aria-hidden="true" />
            <span>Achievements</span>
          </h2>
          {p.achievements.length === 0 ? (
            <p className="text-xs text-slate-400">Compete in tournaments to earn ecosystem badges.</p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-200">
              {p.achievements.map((a) => (
                <li key={a} className="rounded-lg border border-slate-800 bg-[#070B16] px-3 py-2">
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span>Joined Communities ({data.communities.length})</span>
          </h2>
          {data.communities.length === 0 ? (
            <p className="text-xs text-slate-400">No communities joined yet.</p>
          ) : (
            <div className="space-y-2">
              {data.communities.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-800 bg-[#070B16] px-3 py-2 text-xs">
                  <span className="font-semibold text-white">{c.name}</span>
                  <span className="text-slate-400"> · {c.gameFocus} ({c.role})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span>Tournament Participation ({data.tournaments.length})</span>
          </h2>
          {data.tournaments.length === 0 ? (
            <p className="text-xs text-slate-400">No tournament entries yet.</p>
          ) : (
            <div className="space-y-2">
              {data.tournaments.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-800 bg-[#070B16] px-3 py-2 text-xs">
                  <p className="font-semibold text-white">{t.title}</p>
                  <p className="text-slate-400">
                    {t.gameTitle} · Team: {t.teamName} · Status: {t.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
