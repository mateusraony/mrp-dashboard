/**
 * pages.config.js - Page routing configuration
 *
 * Lazy loading via React.lazy para code splitting automático.
 * Cada página é um chunk separado no bundle.
 *
 * THE ONLY EDITABLE VALUE: mainPage
 * Controla qual página é a landing page.
 *
 * PAGE_IMPORTS: funções de import exportadas separadamente para
 * hover-prefetch no Layout — chama import() antecipadamente sem
 * instanciar o componente.
 */
import { lazy } from 'react';
import __Layout from './Layout.jsx';

// Importações separadas para permitir prefetch antecipado via hover
export const PAGE_IMPORTS = {
  Dashboard:          () => import('./pages/Dashboard'),
  Derivatives:        () => import('./pages/DerivativesPage'),
  InstitutionalFlows: () => import('./pages/InstitutionalFlows'),
  Opportunities:      () => import('./pages/Opportunities'),
  Automations:        () => import('./pages/AutomationsPage'),
  Macro:              () => import('./pages/Macro'),
  OnChain:            () => import('./pages/OnChain'),
  Options:            () => import('./pages/Options'),
  Settings:           () => import('./pages/Settings'),
  SpotFlow:           () => import('./pages/SpotFlow'),
  NewsIntelligence:   () => import('./pages/NewsIntelligence'),
  Portfolio:          () => import('./pages/Portfolio'),
  SmartAlerts:        () => import('./pages/SmartAlerts'),
  MarketRegime:       () => import('./pages/MarketRegime'),
  PredictivePanel:    () => import('./pages/PredictivePanel'),
  ExecutiveReport:    () => import('./pages/ExecutiveReport'),
  MacroCalendar:      () => import('./pages/MacroCalendar'),
  MarketSentiment:    () => import('./pages/MarketSentiment'),
  GlobalMarkets:      () => import('./pages/GlobalMarkets'),
  Altcoins:           () => import('./pages/Altcoins'),
  DataSources:        () => import('./pages/DataSources'),
};

export const PAGES = Object.fromEntries(
  Object.entries(PAGE_IMPORTS).map(([key, fn]) => [key, lazy(fn)])
);

export const pagesConfig = {
  mainPage: 'Dashboard',
  Pages: PAGES,
  Layout: __Layout,
};
