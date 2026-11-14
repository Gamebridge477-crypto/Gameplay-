import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, Search, Trophy, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';
import { canUserManageTournament } from '../shared/logic';
import type { Tournament, TournamentRegistration } from '../shared/types';
import tournamentStageImg from '../assets/images/tournament_stage_cup_1794620721742.jpg';

export function TournamentsPage() {
  const { user, navigate } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [gameFilter, setGameFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ tournament: Tournament; participants: TournamentRegistration[] } | null>(null);

  // Registration form
  const [teamName, setTeamName] = useState('');
  const [inGameId, setInGameId] = useState('');

  // Create tournament modal
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGame, setNewGame] = useState('Valorant');
  const [newRegion, setNewRegion] = useState('Ethiopia (Online)');
  const [newFormat, setNewFormat] = useState('5v5 Single Elimination');
  const [newPrize, setNewPrize] = useState('50,000 ETB');
  const [newMax, setNewMax] = useState(16);
  const [newDeadline, setNewDeadline] = useState('2026-12-20');
  const [newStart, setNewStart] = useState('2026-12-23');
  const [newSchedule, setNewSchedule] = useState('');
  const [newRules, setNewRules] = useState('');

  // Organizer result update
  const [resultsInput, setResultsInput] = useState('');
  const [statusInput, setStatusInput] = useState<'open' | 'ongoing' | 'completed'>('open');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (gameFilter !== 'All') params.set('game', gameFilter);
    if (statusFilter !== 'All') params.set('status', statusFilter);

    try {
      const data = await apiRequest<{ tournaments: Tournament[] }>(`/api/tournaments?${params.toString()}`);
      setTournaments(data.tournaments);
      if (data.tournaments.length > 0 && !selectedId) {
        const firstOpen = data.tournaments.find((t) => t.status === 'open');
        setSelectedId((firstOpen || data.tournaments[0]).id);
      }
    } catch {
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [search, gameFilter, statusFilter, selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const data = await apiRequest<{ tournament: Tournament; participants: TournamentRegistration[] }>(
        `/api/tournaments/${id}`
      );
      setDetail(data);
      setResultsInput(data.tournament.resultsSummary || '');
      if (data.tournament.status === 'open' || data.tournament.status === 'ongoing' || data.tournament.status === 'completed') {
        setStatusInput(data.tournament.status);
      }
    } catch {
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    if (!detail) return;
    setErrorMsg(null);
    try {
      await apiRequest(`/api/tournaments/${detail.tournament.id}/register`, {
        method: 'POST',
        body: JSON.stringify({ teamName, inGameId }),
      });
      setFeedback(`Registered for "${detail.tournament.title}".`);
      setTeamName('');
      setInGameId('');
      await loadDetail(detail.tournament.id);
      await loadTournaments();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Registration failed.');
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('auth', { authMode: 'login' });
      return;
    }
    setErrorMsg(null);
    try {
      const created = await apiRequest<{ id: string; status: string }>('/api/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          gameTitle: newGame,
          region: newRegion,
          format: newFormat,
          prizePool: newPrize,
          maxParticipants: newMax,
          registrationDeadline: `${newDeadline}T23:59:00Z`,
          startDate: `${newStart}T16:00:00Z`,
          scheduleSummary: newSchedule,
          rulesSummary: newRules,
        }),
      });
      setFeedback(
        created.status === 'open'
          ? `Tournament "${newTitle}" published and open for registration.`
          : `Tournament "${newTitle}" submitted for admin review.`
      );
      setShowCreate(false);
      setNewTitle('');
      setSelectedId(created.id);
      loadTournaments();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Could not create tournament.');
    }
  };

  const handleUpdateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setErrorMsg(null);
    try {
      await apiRequest(`/api/tournaments/${detail.tournament.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusInput, resultsSummary: resultsInput }),
      });
      setFeedback('Tournament schedule/results updated.');
      loadDetail(detail.tournament.id);
      loadTournaments();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Update failed.');
    }
  };

  const activeT = detail?.tournament;
  const canManage = activeT
    ? canUserManageTournament(user ? { userId: user.userId, role: user.role } : null, {
        organizerId: activeT.organizerId,
      })
    : false;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header + Banner */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#0B1120] p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-medium text-blue-400">Competitive Brackets & Organizers</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Esports Tournaments
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Discover regional competitions, verify registration deadlines, enter your squad, and follow official tournament schedules and results.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!user) navigate('auth', { authMode: 'login' });
                  else setShowCreate(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[40px]"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Create Tournament</span>
              </button>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-lg border border-slate-800 aspect-video bg-[#070B16]">
              <img
                src={tournamentStageImg}
                alt="Championship esports arena stage"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
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

      {/* Search & Filter Controls */}
      <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" aria-hidden="true" />
          <input
            type="text"
            aria-label="Search tournaments"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tournaments, cities..."
            className="w-full rounded-lg border border-slate-700 bg-[#060A14] pl-9 pr-3 py-2 text-xs text-white min-h-[40px]"
          />
        </div>
        <select
          aria-label="Filter tournaments by game"
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
        >
          <option value="All">All Games</option>
          <option value="EA FC 25">EA FC 25</option>
          <option value="Valorant">Valorant</option>
          <option value="PUBG Mobile">PUBG Mobile</option>
          <option value="Tekken 8">Tekken 8</option>
          <option value="Counter-Strike 2">Counter-Strike 2</option>
          <option value="Dota 2">Dota 2</option>
        </select>
        <select
          aria-label="Filter tournaments by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white min-h-[40px]"
        >
          <option value="All">All Statuses</option>
          <option value="open">Open for Registration</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed & Results</option>
          <option value="pending_approval">Pending Approval (Mine/Admin)</option>
        </select>
      </div>

      {/* Master-Detail Tournament Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-5 space-y-3">
          {loading ? (
            <div className="h-64 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
          ) : tournaments.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 text-center text-xs text-slate-400">
              No tournaments match your current filters.
            </div>
          ) : (
            tournaments.map((t) => {
              const selected = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    selected
                      ? 'border-blue-500 bg-[#0F172A]'
                      : 'border-slate-800 bg-[#0B1120] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-blue-400">{t.gameTitle}</span>
                    <span className="capitalize text-slate-400">{t.status.replace('_', ' ')}</span>
                  </div>
                  <h2 className="mt-1 font-display text-base font-semibold text-white">{t.title}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {t.region} · {t.format}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                    <span>Prize: {t.prizePool}</span>
                    <span className="font-mono tabular-nums">
                      {t.registeredCount}/{t.maxParticipants}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-7">
          {!activeT ? (
            <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-8 text-center text-sm text-slate-400">
              Select a tournament to view schedule, rules, results, and registration.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    {activeT.gameTitle} · Hosted by @{activeT.organizerName}
                  </span>
                  <span className="font-mono uppercase text-blue-400">
                    {activeT.status.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold text-white">{activeT.title}</h2>
                <p className="mt-1 text-xs text-slate-400">{activeT.region} · {activeT.format}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-y border-slate-800/80 py-4 text-xs">
                <div>
                  <p className="text-slate-400">Prize Pool</p>
                  <p className="mt-1 font-semibold text-white">{activeT.prizePool}</p>
                </div>
                <div>
                  <p className="text-slate-400">Registration Deadline</p>
                  <p className="mt-1 font-mono tabular-nums text-white">
                    {new Date(activeT.registrationDeadline).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Start Date</p>
                  <p className="mt-1 font-mono tabular-nums text-white">
                    {new Date(activeT.startDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                    <span>Tournament Schedule</span>
                  </p>
                  <p className="mt-1 text-slate-300 leading-relaxed">{activeT.scheduleSummary}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Rules & Verification</p>
                  <p className="mt-1 text-slate-400 leading-relaxed">{activeT.rulesSummary}</p>
                </div>
                {activeT.resultsSummary && (
                  <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3.5">
                    <p className="font-semibold text-violet-300 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Official Results</span>
                    </p>
                    <p className="mt-1 text-slate-200">{activeT.resultsSummary}</p>
                  </div>
                )}
              </div>

              {/* Registration Form */}
              {activeT.status === 'open' && !activeT.isRegistered && (
                <form onSubmit={handleRegister} className="rounded-lg border border-slate-800 bg-[#070B16] p-4 space-y-3">
                  <p className="text-xs font-semibold text-white">Register for This Tournament</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Team Name (or Solo)"
                      className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      required
                      value={inGameId}
                      onChange={(e) => setInGameId(e.target.value)}
                      placeholder="In-Game ID (e.g. Dawit#ETH)"
                      className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[38px]"
                  >
                    Confirm Registration
                  </button>
                </form>
              )}

              {activeT.isRegistered && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200">
                  You are confirmed in this tournament’s participant roster.
                </div>
              )}

              {/* Registered Participants */}
              <div>
                <p className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                  <span>
                    Registered Roster ({detail?.participants.length || 0} / {activeT.maxParticipants})
                  </span>
                </p>
                {(detail?.participants || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No teams registered yet. Be the first to enter.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detail?.participants.map((p) => (
                      <div key={p.id} className="rounded-lg border border-slate-800 bg-[#070B16] px-3 py-2 text-xs">
                        <span className="font-semibold text-white">@{p.username}</span>
                        <span className="text-slate-400"> · {p.teamName} ({p.inGameId})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Organizer Management Controls */}
              {canManage && (
                <form onSubmit={handleUpdateTournament} className="border-t border-slate-800 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-violet-300">Organizer Controls</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={statusInput}
                      onChange={(e) => setStatusInput(e.target.value as any)}
                      className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                    >
                      <option value="open">Open</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                    <input
                      type="text"
                      value={resultsInput}
                      onChange={(e) => setResultsInput(e.target.value)}
                      placeholder="Publish final standings / results..."
                      className="sm:col-span-2 rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white"
                  >
                    Save Tournament Updates
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Tournament Modal */}
      {showCreate && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateTournament}
            className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0B1120] p-6 space-y-3"
          >
            <h2 className="font-display text-lg font-bold text-white">Create Tournament</h2>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Tournament Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Addis Ababa Winter Open"
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Game</label>
                <select
                  value={newGame}
                  onChange={(e) => setNewGame(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                >
                  <option value="Valorant">Valorant</option>
                  <option value="EA FC 25">EA FC 25</option>
                  <option value="PUBG Mobile">PUBG Mobile</option>
                  <option value="Counter-Strike 2">Counter-Strike 2</option>
                  <option value="Tekken 8">Tekken 8</option>
                  <option value="Dota 2">Dota 2</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Format</label>
                <input
                  type="text"
                  required
                  value={newFormat}
                  onChange={(e) => setNewFormat(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Region</label>
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Prize Pool</label>
                <input
                  type="text"
                  value={newPrize}
                  onChange={(e) => setNewPrize(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Max Slots</label>
                <input
                  type="number"
                  min={4}
                  max={256}
                  value={newMax}
                  onChange={(e) => setNewMax(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Registration Deadline</label>
                <input
                  type="date"
                  required
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Schedule Summary</label>
              <input
                type="text"
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                placeholder="Qualifiers Saturday 16:00 EAT, Finals Sunday..."
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Rules Summary</label>
              <textarea
                rows={2}
                value={newRules}
                onChange={(e) => setNewRules(e.target.value)}
                placeholder="Check-in 30 mins prior, anti-cheat enabled..."
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                Submit Tournament
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
