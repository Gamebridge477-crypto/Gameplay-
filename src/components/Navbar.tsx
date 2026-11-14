import { useState } from 'react';
import { Menu, Shield, Wifi, X } from 'lucide-react';
import { useAuth, type AppView } from '../context/AuthContext';

export function Navbar() {
  const { user, view, navigate, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryLinks: { label: string; view: AppView }[] = [
    { label: 'Home', view: 'landing' },
    { label: 'Explore', view: 'explore' },
    { label: 'Tournaments', view: 'tournaments' },
    { label: 'Find Players', view: 'players' },
    { label: 'Communities', view: 'communities' },
  ];

  const handleNav = (v: AppView) => {
    setMobileOpen(false);
    navigate(v);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#060A14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('landing')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-500 rounded-md"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect width="28" height="28" rx="6" fill="#0F172A" stroke="#2563EB" strokeWidth="1.5" />
            <path
              d="M7 18.5C7 13.8056 10.134 10 14 10C17.866 10 21 13.8056 21 18.5"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M10.5 18.5C10.5 15.7386 12.067 13.5 14 13.5C15.933 13.5 17.5 15.7386 17.5 18.5"
              stroke="#8B5CF6"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="14" cy="19" r="1.5" fill="#F8FAFC" />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            GameBridge
          </span>
        </button>

        {/* Zone 2: Primary Navigation Links */}
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-6">
          {primaryLinks.map((item) => {
            const active = view === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => handleNav(item.view)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
                  active
                    ? 'text-white border-blue-500'
                    : 'text-slate-400 border-transparent hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              if (view === 'landing') {
                document.getElementById('about-us')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                navigate('landing');
                setTimeout(() => {
                  document.getElementById('about-us')?.scrollIntoView({ behavior: 'smooth' });
                }, 120);
              }
            }}
            className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 border-transparent"
          >
            About Us
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => handleNav('dashboard')}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Dashboard
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('auth', { authMode: 'login' })}
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => navigate('auth', { authMode: 'signup' })}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
          className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Contextual Secondary Workspace Bar (for quick access to Connection Check, Opportunities, Profile, Admin) */}
      <div className="hidden lg:block border-t border-slate-800/60 bg-[#080D1A]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => handleNav('connection')}
              className={`flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                view === 'connection' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Connection Checker</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('opportunities')}
              className={`font-medium transition-colors whitespace-nowrap shrink-0 ${
                view === 'opportunities' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sponsorships & Opportunities
            </button>
            {user && (
              <button
                type="button"
                onClick={() => handleNav('profile')}
                className={`font-medium transition-colors whitespace-nowrap shrink-0 ${
                  view === 'profile' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                My Profile (@{user.username})
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className={`flex items-center gap-1 font-medium transition-colors whitespace-nowrap shrink-0 ${
                  view === 'admin' ? 'text-violet-400' : 'text-violet-400/80 hover:text-violet-300'
                }`}
              >
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Admin Console</span>
              </button>
            )}
          </div>
          {user && (
            <button
              type="button"
              onClick={() => logout()}
              className="text-slate-400 hover:text-white font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Log Out
            </button>
          )}
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-[#090F1F] px-4 py-4 space-y-2">
          {primaryLinks.map((item) => (
            <button
              key={item.view}
              type="button"
              onClick={() => handleNav(item.view)}
              className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium min-h-[44px] ${
                view === item.view ? 'bg-blue-600/20 text-white' : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleNav('connection')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 min-h-[44px]"
          >
            Connection Checker
          </button>
          <button
            type="button"
            onClick={() => handleNav('opportunities')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 min-h-[44px]"
          >
            Gaming Opportunities
          </button>
          {user ? (
            <>
              <button
                type="button"
                onClick={() => handleNav('dashboard')}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 min-h-[44px]"
              >
                Gamer Dashboard
              </button>
              <button
                type="button"
                onClick={() => handleNav('profile')}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 min-h-[44px]"
              >
                My Profile (@{user.username})
              </button>
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => handleNav('admin')}
                  className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-violet-300 hover:bg-slate-800/60 min-h-[44px]"
                >
                  Admin Dashboard
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-slate-800/60 min-h-[44px]"
              >
                Log Out
              </button>
            </>
          ) : (
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate('auth', { authMode: 'login' });
                }}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-sm font-medium text-slate-200 min-h-[44px]"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate('auth', { authMode: 'signup' });
                }}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-sm font-semibold text-white min-h-[44px]"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
