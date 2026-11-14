import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthView } from './components/AuthView';
import { CommunitiesPage } from './components/CommunitiesPage';
import { ConnectionCheckerPage } from './components/ConnectionCheckerPage';
import { ExplorePage } from './components/ExplorePage';
import { FindPlayersPage } from './components/FindPlayersPage';
import { GamerDashboard } from './components/GamerDashboard';
import { LandingPage } from './components/LandingPage';
import { Navbar } from './components/Navbar';
import { OpportunitiesPage } from './components/OpportunitiesPage';
import { ProfilePage } from './components/ProfilePage';
import { TournamentsPage } from './components/TournamentsPage';

function AppShell() {
  const { view } = useAuth();

  return (
    <div className="min-h-screen bg-[#060A14] text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1">
        {view === 'landing' && <LandingPage />}
        {view === 'explore' && <ExplorePage />}
        {view === 'auth' && <AuthView />}
        {view === 'dashboard' && <GamerDashboard />}
        {view === 'players' && <FindPlayersPage />}
        {view === 'connection' && <ConnectionCheckerPage />}
        {view === 'tournaments' && <TournamentsPage />}
        {view === 'communities' && <CommunitiesPage />}
        {view === 'opportunities' && <OpportunitiesPage />}
        {view === 'profile' && <ProfilePage />}
        {view === 'admin' && <AdminDashboard />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
