import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';

const GAME_OPTIONS = [
  'Valorant',
  'EA FC 25',
  'PUBG Mobile',
  'Counter-Strike 2',
  'Tekken 8',
  'Dota 2',
];

const PLATFORM_OPTIONS = ['PC', 'PlayStation 5', 'Xbox Series', 'Mobile', 'PC & Console'];

export function AuthView() {
  const { authMode, navigate, login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(authMode);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('Ethiopia');
  const [city, setCity] = useState('');
  const [gamingPlatform, setGamingPlatform] = useState('PC');
  const [favoriteGames, setFavoriteGames] = useState<string[]>(['Valorant']);

  // Forgot password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(authMode);
    setError(null);
  }, [authMode]);

  const toggleGame = (game: string) => {
    setFavoriteGames((prev) =>
      prev.includes(game) ? prev.filter((g) => g !== game) : [...prev, game]
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(loginEmail, loginPassword);
      navigate(user.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to log in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (favoriteGames.length === 0) {
      setError('Select at least one favorite game.');
      return;
    }
    setSubmitting(true);
    try {
      await signup({
        fullName,
        username,
        email,
        password,
        country,
        city,
        favoriteGames,
        gamingPlatform,
      });
      navigate('dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; demoResetToken?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: resetEmail }),
        }
      );
      setResetMessage(res.message);
      if (res.demoResetToken) {
        setIssuedCode(res.demoResetToken);
        setResetToken(res.demoResetToken);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to generate reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail, token: resetToken, newPassword }),
      });
      setResetMessage(res.message);
      setMode('login');
      setLoginEmail(resetEmail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setMode('login');
    setLoginEmail(demoEmail);
    setLoginPassword(demoPass);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 sm:p-8">
        {/* Segmented Mode Switch */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#060A14] border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'signup' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'forgot' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Forgot Password
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {resetMessage && (
          <div className="mb-5 rounded-lg border border-blue-500/40 bg-blue-950/40 px-4 py-3 text-xs text-blue-200">
            <p>{resetMessage}</p>
            {issuedCode && (
              <p className="mt-1 font-mono text-white">
                Verification Code: <strong>{issuedCode}</strong>
              </p>
            )}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-white">Welcome Back</h1>
              <p className="mt-1 text-xs text-slate-400">
                Sign in to access your GameBridge dashboard, matchmaking, and tournament brackets.
              </p>
            </div>

            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.et"
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-sm font-semibold text-white transition-colors min-h-[44px]"
            >
              {submitting ? 'Signing In...' : 'Log In'}
            </button>

            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs font-medium text-slate-400 mb-2">
                Demo Accounts (1-Click Credential Fill):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('dawit@gamebridge.et', 'Gamer123!')}
                  className="px-3 py-2 rounded-lg border border-slate-700 bg-[#060A14] hover:border-blue-500 text-xs text-slate-200 text-left"
                >
                  <span className="block font-semibold text-white">Gamer</span>
                  <span className="text-[11px] text-slate-400">dawit_addis</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('selam@abyssiniaesports.et', 'Organizer123!')}
                  className="px-3 py-2 rounded-lg border border-slate-700 bg-[#060A14] hover:border-blue-500 text-xs text-slate-200 text-left"
                >
                  <span className="block font-semibold text-white">Organizer</span>
                  <span className="text-[11px] text-slate-400">selam_abyssinia</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('admin@gamebridge.et', 'Admin123!')}
                  className="px-3 py-2 rounded-lg border border-slate-700 bg-[#060A14] hover:border-violet-500 text-xs text-slate-200 text-left"
                >
                  <span className="block font-semibold text-violet-300">Admin</span>
                  <span className="text-[11px] text-slate-400">gamebridge_admin</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-white">Create Your GameBridge Account</h1>
              <p className="mt-1 text-xs text-slate-400">
                Register once to join tournaments, matchmake with players, and access local gaming clubs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="su-fullname" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  id="su-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Abebe Bikila"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="su-username" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Username
                </label>
                <input
                  id="su-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="abebe_pro"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="su-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  id="su-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@domain.et"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="su-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password (min 6 characters)
                </label>
                <input
                  id="su-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="su-country" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Country
                </label>
                <input
                  id="su-country"
                  type="text"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="su-city" className="block text-xs font-medium text-slate-300 mb-1.5">
                  City / Region (Optional)
                </label>
                <input
                  id="su-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Addis Ababa"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="su-platform" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Gaming Platform
                </label>
                <select
                  id="su-platform"
                  value={gamingPlatform}
                  onChange={(e) => setGamingPlatform(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-2">
                Favorite Games (select one or more)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GAME_OPTIONS.map((game) => {
                  const selected = favoriteGames.includes(game);
                  return (
                    <button
                      key={game}
                      type="button"
                      onClick={() => toggleGame(game)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-600/20 text-white'
                          : 'border-slate-700 bg-[#060A14] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {game}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-sm font-semibold text-white transition-colors min-h-[44px]"
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-white">Reset Your Password</h1>
              <p className="mt-1 text-xs text-slate-400">
                Request a time-limited reset verification code, then enter your new password below.
              </p>
            </div>

            <form onSubmit={handleRequestReset} className="space-y-3">
              <div>
                <label htmlFor="fp-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Account Email
                </label>
                <input
                  id="fp-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="dawit@gamebridge.et"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white min-h-[40px]"
              >
                Generate Reset Code
              </button>
            </form>

            <form onSubmit={handleConfirmReset} className="space-y-3 border-t border-slate-800 pt-5">
              <div>
                <label htmlFor="fp-code" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Reset Verification Code
                </label>
                <input
                  id="fp-code"
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="8-character code"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="fp-newpass" className="block text-xs font-medium text-slate-300 mb-1.5">
                  New Password
                </label>
                <input
                  id="fp-newpass"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (6+ chars)"
                  className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white min-h-[44px]"
              >
                Update Password
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
