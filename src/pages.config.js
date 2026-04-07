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
// ─── Páginas ativas (após merges) ─────────────────────────────────────────────
import Dashboard from './pages/Dashboard';
import DerivativesPage from './pages/DerivativesPage';
import InstitutionalFlows from './pages/InstitutionalFlows';
import Opportunities from './pages/Opportunities';
import AutomationsPage from './pages/AutomationsPage';
import Macro from './pages/Macro';
import OnChain from './pages/OnChain';
import Options from './pages/Options';
import Settings from './pages/Settings';
import SpotFlow from './pages/SpotFlow';
import NewsIntelligence from './pages/NewsIntelligence';
import Portfolio from './pages/Portfolio';
import SmartAlerts from './pages/SmartAlerts';
import MarketRegime from './pages/MarketRegime';
import PredictivePanel from './pages/PredictivePanel';
import ExecutiveReport from './pages/ExecutiveReport';
import MacroCalendar from './pages/MacroCalendar';
import MarketSentiment from './pages/MarketSentiment';
import GlobalMarkets from './pages/GlobalMarkets';
import __Layout from './Layout.jsx';

export const PAGES = {
    "Dashboard": Dashboard,
    "Derivatives": DerivativesPage,
    "InstitutionalFlows": InstitutionalFlows,
    "Opportunities": Opportunities,
    "Automations": AutomationsPage,
    "Macro": Macro,
    "OnChain": OnChain,
    "Options": Options,
    "Settings": Settings,
    "SpotFlow": SpotFlow,
    "NewsIntelligence": NewsIntelligence,
    "Portfolio": Portfolio,
    "SmartAlerts": SmartAlerts,
    "MarketRegime": MarketRegime,
    "PredictivePanel": PredictivePanel,
    "ExecutiveReport": ExecutiveReport,
    "MacroCalendar": MacroCalendar,
    "MarketSentiment": MarketSentiment,
    "GlobalMarkets": GlobalMarkets,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};