import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { setupIframeMessaging } from './lib/iframe-messaging';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from '@/components/auth/LoginPage';
import LandingPage from '@/pages/Landing';

import AllPlayersViewPage from './pages/AllPlayersView';
import ApplyForLeaguePage from './pages/ApplyForLeague';
import StoryBuilderPage from './pages/StoryBuilder';
import LeagueUsersPage from './pages/LeagueUsers';
import RegularSeasonRecapPage from './pages/RegularSeasonRecap';
const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

setupIframeMessaging();

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  // Show loading spinner while checking session
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show login page when not authenticated
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/Landing" element={<LandingPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Render the main app
  return (
    <LayoutWrapper currentPageName={mainPageKey}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<MainPage />} handle={{ pageName: mainPageKey }} />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route key={path} path={`/${path}`} element={<Page />} handle={{ pageName: path }} />
        ))}
        <Route path="/AllPlayersView" element={<LayoutWrapper currentPageName="AllPlayersView"><AllPlayersViewPage /></LayoutWrapper>} />
        <Route path="/LeagueUsers" element={<LayoutWrapper currentPageName="LeagueUsers"><LeagueUsersPage /></LayoutWrapper>} />
        <Route path="/StoryBuilder" element={<LayoutWrapper currentPageName="StoryBuilder"><StoryBuilderPage /></LayoutWrapper>} />
        <Route path="/ApplyForLeague" element={<LayoutWrapper currentPageName="ApplyForLeague"><ApplyForLeaguePage /></LayoutWrapper>} />
        <Route path="/RegularSeasonRecap" element={<LayoutWrapper currentPageName="RegularSeasonRecap"><RegularSeasonRecapPage /></LayoutWrapper>} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </LayoutWrapper>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App