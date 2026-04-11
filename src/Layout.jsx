import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  LayoutDashboard, Activity, FileBarChart2,
  TrendingUp, BarChart3, ArrowUpDown, Sigma, Building2,
  Link2, Globe, Globe2, CalendarDays,
  Newspaper, Brain,
  Zap, Bell, Bot, Briefcase,
  Settings, ChevronLeft, ChevronRight, Menu, Bitcoin, CandlestickChart,
} from 'lucide-react';
import { btcFutures } from '@/components/data/mockData';

// ─── NAVEGAÇÃO ─────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'VISÃO GERAL',
    items: [
      { label: 'Overview',        icon: LayoutDashboard,  page: 'Dashboard',        desc: 'Risk Score · BTC · AI' },
      { label: 'Regime',          icon: Activity,          page: 'MarketRegime',     desc: 'Risk-On · Off · Neutral' },
      { label: 'Relatório Exec.', icon: FileBarChart2,     page: 'ExecutiveReport',  desc: 'Consolidado · PDF · Email' },
    ],
  },
  {
    label: 'CRIPTO — MERCADO',
    items: [
      { label: 'Preditivo BTC',  icon: TrendingUp,   page: 'PredictivePanel',    desc: 'BTC 24h · Cenários AI' },
      { label: 'Derivatives',    icon: BarChart3,     page: 'Derivatives',        desc: 'Overview · Avançado · Liq.' },
      { label: 'Spot Flow',      icon: ArrowUpDown,   page: 'SpotFlow',           desc: 'CVD · Volume · Taker' },
      { label: 'Options',        icon: Sigma,         page: 'Options',            desc: 'IV · Greeks · Skew' },
      { label: 'Fluxos Instit.', icon: Building2,          page: 'InstitutionalFlows', desc: 'ETFs · Stablecoins' },
      { label: 'Altcoins',       icon: CandlestickChart,    page: 'Altcoins',           desc: 'Dominância · Alt Season · Rotação' },
    ],
  },
  {
    label: 'ON-CHAIN & MACRO',
    items: [
      { label: 'On-Chain',       icon: Link2,         page: 'OnChain',       desc: 'NUPL · MVRV · Whales' },
      { label: 'Macro Board',    icon: Globe,         page: 'Macro',         desc: 'S&P · DXY · Yields FRED' },
      { label: 'Mercados Glob.', icon: Globe2,        page: 'GlobalMarkets', desc: 'FX · BRL · EUR · Ouro' },
      { label: 'Calendário',     icon: CalendarDays,  page: 'MacroCalendar', desc: 'CPI · FOMC · NFP · Horários' },
    ],
  },
  {
    label: 'INTELIGÊNCIA AI',
    items: [
      { label: 'Notícias',   icon: Newspaper, page: 'NewsIntelligence', desc: 'AI Score · Feed · Institucional' },
      { label: 'Sentimento', icon: Brain,     page: 'MarketSentiment',  desc: 'X · Reddit · Word Cloud · KOLs' },
    ],
  },
  {
    label: 'AUTOMAÇÕES',
    items: [
      { label: 'Oportunidades', icon: Zap,      page: 'Opportunities', desc: 'Ações AI · Estratégias' },
      { label: 'Alertas',       icon: Bell,     page: 'SmartAlerts',   desc: 'AI · Config · Ciclo' },
      { label: 'Automações',    icon: Bot,      page: 'Automations',   desc: 'Regras · Bots · Webhooks' },
      { label: 'Portfolio',     icon: Briefcase,page: 'Portfolio',     desc: 'Posições · Greeks · Stress' },
    ],
  },
  {
    label: '',
    items: [
      { label: 'Settings', icon: Settings, page: 'Settings', desc: '' },
    ],
  },
];

// ─── BTC TICKER — usa mock data dinâmico ────────────────────────────────────
const btcPrice = btcFutures.mark_price;
const btcDelta = btcFutures.oi_delta_pct;

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#070B14' }}>
      {/* ── MOBILE OVERLAY ── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 49 }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: collapsed ? 58 : 216,
        minWidth: collapsed ? 58 : 216,
        background: '#0A1220',
        borderRight: '1px solid #162032',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 50,
        position: 'fixed',
        top: 0,
        left: mobileOpen ? 0 : undefined,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        transform: isMobile && !mobileOpen ? 'translateX(-100%)' : 'translateX(0)',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '16px 13px' : '16px 14px',
          borderBottom: '1px solid #162032',
          display: 'flex', alignItems: 'center', gap: 9,
          minHeight: 58, flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(59,130,246,0.35)',
          }}>
            <Bitcoin size={16} color="#fff" />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                CryptoWatch
              </div>
              <div style={{ fontSize: 9, color: '#3b5068', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                INSTITUTIONAL
              </div>
            </div>
          )}
        </div>

        {/* Mock badge */}
        {!collapsed && (
          <div style={{ padding: '8px 14px 4px', flexShrink: 0 }}>
            <span style={{
              fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(245,158,11,0.1)', color: '#d97706',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 4, padding: '2px 7px', letterSpacing: '0.07em', fontWeight: 700,
            }}>
              MOCK DATA
            </span>
          </div>
        )}

        {/* Nav groups */}
        <nav style={{ padding: '6px 8px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: collapsed ? 8 : 4 }}>
              {/* Group label */}
              {!collapsed && group.label && (
                <div style={{
                  fontSize: 8, fontWeight: 800, color: '#1e3048',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '10px 8px 4px', whiteSpace: 'nowrap',
                }}>
                  {group.label}
                </div>
              )}
              {collapsed && group.label && gi > 0 && (
                <div style={{ height: 1, background: '#162032', margin: '6px 4px' }} />
              )}
              {/* Nav items */}
              {group.items.map(({ label, icon: Icon, page, desc }) => {
                const active = currentPageName === page;
                return (
                  <Link
                    key={page}
                    to={createPageUrl(page)}
                    onClick={() => isMobile && setMobileOpen(false)}
                    title={collapsed ? `${label} — ${desc}` : undefined}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: collapsed ? 0 : 9,
                      padding: collapsed ? '8px 0' : '7px 10px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderRadius: 7,
                      textDecoration: 'none',
                      marginBottom: 1,
                      color: active ? '#60a5fa' : '#4a6580',
                      background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                      borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
                      transition: 'all 0.12s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; e.currentTarget.style.color = active ? '#60a5fa' : '#8aa5c0'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(59,130,246,0.1)' : 'transparent'; e.currentTarget.style.color = active ? '#60a5fa' : '#4a6580'; }}
                  >
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    {!collapsed && (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{label}</div>
                        {desc && <div style={{ fontSize: 9, color: active ? '#3b5068' : '#1e3048', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{desc}</div>}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse btn */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            margin: '8px 8px 12px',
            padding: '7px 8px',
            borderRadius: 7,
            background: 'transparent',
            border: '1px solid #162032',
            color: '#2a4060',
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'border-color 0.15s, color 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#2a4060'; e.currentTarget.style.color = '#475569'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#162032'; e.currentTarget.style.color = '#2a4060'; }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', marginLeft: isMobile ? 0 : (collapsed ? 58 : 216), transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* Topbar */}
        <header style={{
          height: 50,
          borderBottom: '1px solid #0f1d2e',
          background: 'rgba(7,11,20,0.98)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px',
          gap: 10,
          position: 'sticky', top: 0, zIndex: 40,
        }}>
          {/* Mobile menu button */}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(o => !o)}
              style={{
                background: 'transparent', border: '1px solid #162032',
                color: '#4a6580', cursor: 'pointer', borderRadius: 6,
                padding: '5px 9px', display: 'flex', alignItems: 'center',
              }}
            >
              <Menu size={16} />
            </button>
          )}

          {/* Page title area */}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: '#1e3048', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {currentPageName === 'Dashboard' ? 'Market Overview' : currentPageName}
            </span>
          </div>

          {/* Live clock */}
          <LiveClock />

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: '#162032' }} />

          {/* BTC ticker — conectado ao mock data dinâmico */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 7, padding: '4px 10px',
          }}>
            <span style={{ fontSize: 11, color: '#2a4060', fontWeight: 700 }}>₿</span>
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa', fontWeight: 700 }}>
              ${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span style={{ fontSize: 10, color: btcDelta >= 0 ? '#10b981' : '#ef4444', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {btcDelta >= 0 ? '+' : ''}{btcDelta.toFixed(2)}%
            </span>
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ fontSize: 10, color: '#2a4060', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>MOCK</span>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px 22px', overflowY: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2a4060', display: 'flex', alignItems: 'center', gap: 4 }}>
      {time.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })}
      <span style={{ fontSize: 9, color: '#1e3048' }}>BRT</span>
    </div>
  );
}
