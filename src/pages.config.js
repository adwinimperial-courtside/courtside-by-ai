import Leagues from './pages/Leagues';
import Teams from './pages/Teams';
import Schedule from './pages/Schedule';
import LiveGame from './pages/LiveGame';
import Statistics from './pages/Statistics';
import Layout from './Layout.jsx';


export const PAGES = {
    "Leagues": Leagues,
    "Teams": Teams,
    "Schedule": Schedule,
    "LiveGame": LiveGame,
    "Statistics": Statistics,
}

export const pagesConfig = {
    mainPage: "Leagues",
    Pages: PAGES,
    Layout: Layout,
};