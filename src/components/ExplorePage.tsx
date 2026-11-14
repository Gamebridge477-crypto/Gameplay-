import { ArrowRight, Briefcase, Shield, Trophy, Users, Wifi } from 'lucide-react';
import { useAuth, type AppView } from '../context/AuthContext';

export function ExplorePage() {
  const { user, navigate } = useAuth();

  const modules: {
    title: string;
    subtitle: string;
    view: AppView;
    icon: typeof Trophy;
    cta: string;
  }[] = [
    {
      title: 'Find Players & Team Matchmaking',
      subtitle: 'Filter teammates by game, platform, language, Ethiopian/African city, availability, and playstyle. Send and accept team invitations.',
      view: 'players',
      icon: Users,
      cta: 'Open Matchmaking',
    },
    {
      title: 'Tournaments & Brackets',
      subtitle: 'Search active cups, inspect schedules and rules, register your squad, or publish and manage your own esports tournament.',
      view: 'tournaments',
      icon: Trophy,
      cta: 'Browse Tournaments',
    },
    {
      title: 'Internet Connection Checker',
      subtitle: 'Measure real download speed, upload speed, ping, and jitter against server nodes with practical Ethiopian routing guidance.',
      view: 'connection',
      icon: Wifi,
      cta: 'Run Speed Test',
    },
    {
      title: 'Gaming Communities & Clubs',
      subtitle: 'Discover city and university clubs, post team activities and announcements, and report inappropriate content.',
      view: 'communities',
      icon: Shield,
      cta: 'Explore Clubs',
    },
    {
      title: 'Sponsorships, Gear Access & Careers',
      subtitle: 'Apply for team sponsorships, free bootcamp PC/console access, esports observer fellowships, and regional gaming events.',
      view: 'opportunities',
      icon: Briefcase,
      cta: 'View Opportunities',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl mb-10">
        <p className="text-xs font-medium text-blue-400">GameBridge Ecosystem Directory</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
          Explore the Platform
        </h1>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Navigate directly to matchmaking, live tournament registration, network diagnostics, clubs, or verified sponsorship opportunities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.view}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0B1120] p-6 hover:border-blue-500/50 transition-colors"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 font-display text-lg font-semibold text-white">{m.title}</h2>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{m.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(m.view)}
                className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-slate-800/80 hover:bg-blue-600 text-xs font-semibold text-white transition-colors min-h-[40px]"
              >
                <span>{m.cta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}

        <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#080D1B] p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {user ? `Signed in as @${user.username}` : 'Create Your Gamer Profile'}
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              {user
                ? 'Open your personalized dashboard for recommended teammates, tournament updates, and notifications.'
                : 'Sign up in seconds to unlock personalized matchmaking, tournament registrations, and community posting.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              user ? navigate('dashboard') : navigate('auth', { authMode: 'signup' })
            }
            className="mt-6 w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors min-h-[40px]"
          >
            {user ? 'Open Gamer Dashboard' : 'Sign Up Free'}
          </button>
        </div>
      </div>
    </div>
  );
}
