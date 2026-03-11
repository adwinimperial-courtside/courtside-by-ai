/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminTools from './pages/AdminTools';
import Analytics from './pages/Analytics';
import AwardLeaders from './pages/AwardLeaders';
import CoachInsights from './pages/CoachInsights';
import Coaches from './pages/Coaches';
import GameLog from './pages/GameLog';
import Home from './pages/Home';
import Landing from './pages/Landing';
import LeagueIDs from './pages/LeagueIDs';
import LeagueOwners from './pages/LeagueOwners';
import LeagueSelection from './pages/LeagueSelection';
import Leagues from './pages/Leagues';
import LiveBoxScore from './pages/LiveBoxScore';
import LiveGame from './pages/LiveGame';
import Players from './pages/Players';
import RequestManagement from './pages/RequestManagement';
import Schedule from './pages/Schedule';
import Standings from './pages/Standings';
import Statistics from './pages/Statistics';
import Teams from './pages/Teams';
import UserRoles from './pages/UserRoles';
import Viewers from './pages/Viewers';
import Whiteboard from './pages/Whiteboard';
import UserManagement from './pages/UserManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminTools": AdminTools,
    "Analytics": Analytics,
    "AwardLeaders": AwardLeaders,
    "CoachInsights": CoachInsights,
    "Coaches": Coaches,
    "GameLog": GameLog,
    "Home": Home,
    "Landing": Landing,
    "LeagueIDs": LeagueIDs,
    "LeagueOwners": LeagueOwners,
    "LeagueSelection": LeagueSelection,
    "Leagues": Leagues,
    "LiveBoxScore": LiveBoxScore,
    "LiveGame": LiveGame,
    "Players": Players,
    "RequestManagement": RequestManagement,
    "Schedule": Schedule,
    "Standings": Standings,
    "Statistics": Statistics,
    "Teams": Teams,
    "UserRoles": UserRoles,
    "Viewers": Viewers,
    "Whiteboard": Whiteboard,
    "UserManagement": UserManagement,
}

export const pagesConfig = {
    mainPage: "Schedule",
    Pages: PAGES,
    Layout: __Layout,
};