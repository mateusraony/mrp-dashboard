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
import Alerts from './pages/Alerts';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard';
import Derivatives from './pages/Derivatives';
import Macro from './pages/Macro';
import News from './pages/News';
import OnChain from './pages/OnChain';
import Options from './pages/Options';
import Settings from './pages/Settings';
import SpotFlow from './pages/SpotFlow';
import ETFFlows from './pages/ETFFlows';
import NewsIntelligence from './pages/NewsIntelligence';
import Strategies from './pages/Strategies';
import Portfolio from './pages/Portfolio';
import SmartAlerts from './pages/SmartAlerts';
import StablecoinFlow from './pages/StablecoinFlow';
import MarketRegime from './pages/MarketRegime';
import Automations from './pages/Automations';
import PredictivePanel from './pages/PredictivePanel';
import DerivativesAdvanced from './pages/DerivativesAdvanced';
import ExecutiveReport from './pages/ExecutiveReport';
import ActionDashboard from './pages/ActionDashboard';
import BotAutomations from './pages/BotAutomations';
import MacroCalendar from './pages/MacroCalendar';
import MarketSentiment from './pages/MarketSentiment';
import GlobalMarkets from './pages/GlobalMarkets';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Alerts": Alerts,
    "Calendar": Calendar,
    "Dashboard": Dashboard,
    "Derivatives": Derivatives,
    "Macro": Macro,
    "News": News,
    "OnChain": OnChain,
    "Options": Options,
    "Settings": Settings,
    "SpotFlow": SpotFlow,
    "ETFFlows": ETFFlows,
    "NewsIntelligence": NewsIntelligence,
    "Strategies": Strategies,
    "Portfolio": Portfolio,
    "SmartAlerts": SmartAlerts,
    "StablecoinFlow": StablecoinFlow,
    "MarketRegime": MarketRegime,
    "Automations": Automations,
    "PredictivePanel": PredictivePanel,
    "DerivativesAdvanced": DerivativesAdvanced,
    "ExecutiveReport": ExecutiveReport,
    "ActionDashboard": ActionDashboard,
    "BotAutomations": BotAutomations,
    "MacroCalendar": MacroCalendar,
    "MarketSentiment": MarketSentiment,
    "GlobalMarkets": GlobalMarkets,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};