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
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Landing from './pages/Landing';
import AllPlayersViewPage from './pages/AllPlayersView';
import ApplyForLeaguePage from './pages/ApplyForLeague';
import StoryBuilderPage from './pages/StoryBuilder';
import LeagueUsersPage from './pages/LeagueUsers';
import RegularSeasonRecapPage from './pages/RegularSeasonRecap';
import SystemPage from './pages/System';
import ReportsPage from './pages/Reports';
import PeoplePage from './pages/People';
import OwnerLeagueLeadersPage from './pages/OwnerLeagueLeaders';
import PrivacyPolicyPage from './pages/PrivacyPolicy';
import TermsOfUsePage from './pages/TermsOfUse';
import GameOverlayPage from './pages/GameOverlay';
import GameOverlaySettingsPage from './pages/GameOverlaySettings';
import CommandCenterPage from './pages/CommandCenter';
import OnboardingBookingsPage from './pages/OnboardingBookings';
import JoinKOEPage from './pages/JoinKOE';
import JoinFinNoyCoachPage from './pages/JoinFinNoyCoach';
import CoachRosterPage from './pages/CoachRoster';
const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

setupIframeMessaging();

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // JOIN_KOE_REDIRECT_V1 — if the user arrived via the KOE join link, remember it so we can
      // return them to /JoinKOE after sign-in (base44 otherwise drops new signups on the home route).
      try {
        if (window.location.pathname.toLowerCase().includes('joinkoe')) {
          localStorage.setItem('koe_signup_intent', '1');
        }
        // JOIN_FINNOY_COACH_V1 — same pattern for the Fin-Noy coach signup link
        if (window.location.pathname.toLowerCase().includes('finoy40upseason6-coach')) {
          localStorage.setItem('finnoy_coach_intent', '1');
        }
      } catch (e) {}
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // JOIN_KOE_REDIRECT_V1 — once authenticated, send KOE-link arrivals to /JoinKOE (which renders
  // outside the Layout, bypassing the normal RegistrationGate). Clear the marker so it fires once.
  try {
    if (localStorage.getItem('koe_signup_intent') === '1' &&
        !window.location.pathname.toLowerCase().includes('joinkoe')) {
      localStorage.removeItem('koe_signup_intent');
      window.location.replace('/JoinKOE');
      return null;
    }
    // JOIN_FINNOY_COACH_V1 — once authenticated, send Fin-Noy-link arrivals back to the
    // coach signup page (which renders outside the Layout, bypassing the RegistrationGate).
    if (localStorage.getItem('finnoy_coach_intent') === '1' &&
        !window.location.pathname.toLowerCase().includes('finoy40upseason6-coach')) {
      localStorage.removeItem('finnoy_coach_intent');
      window.location.replace('/Finoy40upSeason6-Coach');
      return null;
    }
  } catch (e) {}

  // Render the main app — overlay is layout-free
  return (
    <Routes>
      <Route path="/GameOverlay" element={<GameOverlayPage />} />
      {/* JOIN_KOE_ROUTE_V1 — rendered OUTSIDE the Layout so the RegistrationGate never intercepts new KOE signups */}
      <Route path="/JoinKOE" element={<JoinKOEPage />} />
      {/* JOIN_FINNOY_COACH_V1 — rendered OUTSIDE the Layout so the RegistrationGate never intercepts new coach signups */}
      <Route path="/Finoy40upSeason6-Coach" element={<JoinFinNoyCoachPage />} />
      <Route path="*" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <Routes>
            <Route path="/" element={<Landing />} handle={{ pageName: "Landing" }} />
            {Object.entries(Pages).map(([path, Page]) => (
              <Route key={path} path={`/${path}`} element={<Page />} handle={{ pageName: path }} />
            ))}
            <Route path="/AllPlayersView" element={<LayoutWrapper currentPageName="AllPlayersView"><AllPlayersViewPage /></LayoutWrapper>} />
            <Route path="/LeagueUsers" element={<LayoutWrapper currentPageName="LeagueUsers"><LeagueUsersPage /></LayoutWrapper>} />
            <Route path="/StoryBuilder" element={<LayoutWrapper currentPageName="StoryBuilder"><StoryBuilderPage /></LayoutWrapper>} />
            <Route path="/ApplyForLeague" element={<LayoutWrapper currentPageName="ApplyForLeague"><ApplyForLeaguePage /></LayoutWrapper>} />
            <Route path="/RegularSeasonRecap" element={<LayoutWrapper currentPageName="RegularSeasonRecap"><RegularSeasonRecapPage /></LayoutWrapper>} />
            <Route path="/OwnerLeagueLeaders" element={<LayoutWrapper currentPageName="OwnerLeagueLeaders"><OwnerLeagueLeadersPage /></LayoutWrapper>} />
            <Route path="/System" element={<LayoutWrapper currentPageName="System"><SystemPage /></LayoutWrapper>} />
            <Route path="/Reports" element={<LayoutWrapper currentPageName="Reports"><ReportsPage /></LayoutWrapper>} />
            <Route path="/People" element={<LayoutWrapper currentPageName="People"><PeoplePage /></LayoutWrapper>} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-use" element={<TermsOfUsePage />} />
            <Route path="/GameOverlaySettings" element={<LayoutWrapper currentPageName="GameOverlaySettings"><GameOverlaySettingsPage /></LayoutWrapper>} />
            <Route path="/CommandCenter" element={<LayoutWrapper currentPageName="CommandCenter"><CommandCenterPage /></LayoutWrapper>} />
            <Route path="/OnboardingBookings" element={<LayoutWrapper currentPageName="OnboardingBookings"><OnboardingBookingsPage /></LayoutWrapper>} />
            <Route path="/CoachRoster" element={<LayoutWrapper currentPageName="CoachRoster"><CoachRosterPage /></LayoutWrapper>} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </LayoutWrapper>
      } />
    </Routes>
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