/**
 * pages.config.js - Page routing configuration
 *
 * Lazy loading via React.lazy para code splitting automático.
 * Cada página é um chunk separado no bundle.
 *
 * THE ONLY EDITABLE VALUE: mainPage
 * Controla qual página é a landing page.
 */
import { lazy } from 'react';
import __Layout from './Layout.jsx';

export const PAGES = {
  Dashboard:          lazy(() => import('./pages/Dashboard')),
  Derivatives:        lazy(() => import('./pages/DerivativesPage')),
  InstitutionalFlows: lazy(() => import('./pages/InstitutionalFlows')),
  Opportunities:      lazy(() => import('./pages/Opportunities')),
  Automations:        lazy(() => import('./pages/AutomationsPage')),
  Macro:              lazy(() => import('./pages/Macro')),
  OnChain:            lazy(() => import('./pages/OnChain')),
  Options:            lazy(() => import('./pages/Options')),
  Settings:           lazy(() => import('./pages/Settings')),
  SpotFlow:           lazy(() => import('./pages/SpotFlow')),
  NewsIntelligence:   lazy(() => import('./pages/NewsIntelligence')),
  Portfolio:          lazy(() => import('./pages/Portfolio')),
  SmartAlerts:        lazy(() => import('./pages/SmartAlerts')),
  MarketRegime:       lazy(() => import('./pages/MarketRegime')),
  PredictivePanel:    lazy(() => import('./pages/PredictivePanel')),
  ExecutiveReport:    lazy(() => import('./pages/ExecutiveReport')),
  MacroCalendar:      lazy(() => import('./pages/MacroCalendar')),
  MarketSentiment:    lazy(() => import('./pages/MarketSentiment')),
  GlobalMarkets:      lazy(() => import('./pages/GlobalMarkets')),
  Altcoins:           lazy(() => import('./pages/Altcoins')),
};

export const pagesConfig = {
  mainPage: 'Dashboard',
  Pages: PAGES,
  Layout: __Layout,
};
