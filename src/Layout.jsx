import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PAGE_IMPORTS } from './pages.config';

// Prefetch antecipado: dispara o import() no hover para que o chunk
// já esteja em cache quando o usuário clicar no item.
function prefetchPage(page) {
  if (page && PAGE_IMPORTS[page]) {
    PAGE_IMPORTS[page]().catch(() => {});
  }
}
import {
  LayoutDashboard, Activity, FileBarChart2,
  TrendingUp, BarChart3, ArrowUpDown, Sigma, Building2,
  Link2, Globe, Globe2, CalendarDays,
  Newspaper, Brain,
  Zap, Bell, Bot, Briefcase, CandlestickChart,
  Settings, ChevronLeft, ChevronRight, Bitcoin,
  MoreHorizontal, X, Database,
} from 'lucide-react';
import { btcFutures } from '@/components/data/mockData';
import DebugPanel from '@/components/ui/DebugPanel';
import { DATA_MODE } from '@/lib/env';
import { useBtcTicker, useBtcPriceWs } from '@/hooks/useBtcData';

// ─── NAVEGAÇÃO ─────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Visão Geral',
    items: [
      { label: 'Overview',        icon: LayoutDashboard,  page: 'Dashboard',        desc: 'Risk Score · BTC · AI' },
      { label: 'Regime',          icon: Activity,          page: 'MarketRegime',     desc: 'Risk-On · Off · Neutral' },
      { label: 'Relatório Exec.', icon: FileBarChart2,     page: 'ExecutiveReport',  desc: 'PDF · Email · Consolidado' },
    ],
  },
  {
    label: 'Cripto — Mercado',
    items: [
      { label: 'Preditivo BTC',  icon: TrendingUp,         page: 'PredictivePanel',    desc: 'BTC 24h · Cenários AI' },
      { label: 'Derivatives',    icon: BarChart3,           page: 'Derivatives',        desc: 'OI · Funding · Liq.' },
      { label: 'Spot Flow',      icon: ArrowUpDown,         page: 'SpotFlow',           desc: 'CVD · Volume · Sessões' },
      { label: 'Options',        icon: Sigma,               page: 'Options',            desc: 'IV · Greeks · Skew' },
      { label: 'Institucional',  icon: Building2,           page: 'InstitutionalFlows', desc: 'ETFs · Stablecoins' },
      { label: 'Altcoins',       icon: CandlestickChart,    page: 'Altcoins',           desc: 'Alt Season · Dominância' },
    ],
  },
  {
    label: 'On-Chain & Macro',
    items: [
      { label: 'On-Chain',       icon: Link2,         page: 'OnChain',       desc: 'NUPL · MVRV · Whales' },
      { label: 'Macro Board',    icon: Globe,         page: 'Macro',         desc: 'S&P · DXY · Yields' },
      { label: 'Glob. Markets',  icon: Globe2,        page: 'GlobalMarkets', desc: 'FX · BRL · EUR · Ouro' },
      { label: 'Calendário',     icon: CalendarDays,  page: 'MacroCalendar', desc: 'CPI · FOMC · Surpresa' },
    ],
  },
  {
    label: 'Inteligência AI',
    items: [
      { label: 'Notícias',   icon: Newspaper, page: 'NewsIntelligence', desc: 'AI Score · Feed · Inst.' },
      { label: 'Sentimento', icon: Brain,     page: 'MarketSentiment',  desc: 'X · Reddit · KOLs' },
    ],
  },
  {
    label: 'Automações',
    items: [
      { label: 'Oportunidades', icon: Zap,       page: 'Opportunities', desc: 'Ações AI · Estratégias' },
      { label: 'Alertas',       icon: Bell,      page: 'SmartAlerts',   desc: 'AI · Config · Ciclo' },
      { label: 'Automações',    icon: Bot,       page: 'Automations',   desc: 'Regras · Bots · Webhooks' },
      { label: 'Portfolio',     icon: Briefcase, page: 'Portfolio',     desc: 'Greeks · VaR · Sharpe' },
    ],
  },
  {
    label: '',
    items: [
      { label: 'Settings',      icon: Settings,  page: 'Settings',     desc: 'Config · API · Alertas' },
      { label: 'Fontes de Dados', icon: Database, page: 'DataSources', desc: 'LIVE · MOCK · Confiança · APIs' },
    ],
  },
];

// ─── MOBILE BOTTOM NAV (5 primary destinations) ──────────────────────────────
const BOTTOM_TABS = [
  { label: 'Overview',  icon: LayoutDashboard, page: 'Dashboard' },
  { label: 'Markets',   icon: BarChart3,        page: 'Derivatives' },
  { label: 'Macro',     icon: Globe,            page: 'Macro' },
  { label: 'AI',        icon: Brain,            page: 'NewsIntelligence' },
  { label: 'Mais',      icon: MoreHorizontal,   page: null }, // opens drawer
];


// ─── LIVE CLOCK ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="topbar-clock" style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
      color: '#2a4060', display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {time.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })}
      <span style={{ fontSize: 9, color: '#1e3048' }}>BRT</span>
    </div>
  );
}

// ─── SIDEBAR NAV ITEM ─────────────────────────────────────────────────────────
function NavItem({ label, icon: Icon, page, desc, active, collapsed, onClick = undefined }) {
  return (
    <Link
      to={createPageUrl(page)}
      onClick={onClick}
      onMouseEnter={() => prefetchPage(page)}
      title={collapsed ? `${label} — ${desc}` : undefined}
      className="nav-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: collapsed ? '9px 0' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        textDecoration: 'none',
        marginBottom: 1,
        color: active ? '#93c5fd' : '#3b5068',
        background: active
          ? 'linear-gradient(90deg, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.03) 70%, transparent 100%)'
          : 'transparent',
        borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
        boxShadow: active ? 'inset 0 0 24px rgba(59,130,246,0.04)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Icon
        size={14}
        style={{
          flexShrink: 0,
          color: active ? '#60a5fa' : 'inherit',
          filter: active ? 'drop-shadow(0 0 6px rgba(96,165,250,0.5))' : 'none',
        }}
      />
      {!collapsed && (
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 12,
            fontWeight: active ? 700 : 500,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            color: active ? '#dbeafe' : '#4a6580',
          }}>
            {label}
          </div>
          {desc && (
            <div style={{
              fontSize: 9,
              color: active ? 'rgba(96,165,250,0.5)' : '#1a2d3f',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
              marginTop: 1,
            }}>
              {desc}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

// ─── MOBILE DRAWER (full-screen nav) ─────────────────────────────────────────
function MobileDrawer({ currentPageName, onClose }) {
  return (
    <div className="mobile-drawer">
      {/* Drawer header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid #162032',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(59,130,246,0.4)',
          }}>
            <Bitcoin size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>CryptoWatch</div>
            <div style={{ fontSize: 9, color: '#1e3048', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>INSTITUTIONAL</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid #162032',
            borderRadius: 8, padding: '8px', cursor: 'pointer',
            color: '#4a6580', display: 'flex', alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* All nav groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 16 }}>
            {group.label && (
              <div style={{
                fontSize: 8, fontWeight: 800, color: '#1e3048',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '4px 4px 8px',
              }}>
                {group.label}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {group.items.map(({ label, icon: Icon, page, desc }) => {
                const active = currentPageName === page;
                return (
                  <Link
                    key={page}
                    to={createPageUrl(page)}
                    onClick={onClose}
                    onMouseEnter={() => prefetchPage(page)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                      background: active
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(59,130,246,0.3)' : 'rgba(22,32,50,0.8)'}`,
                      color: active ? '#93c5fd' : '#4a6580',
                    }}
                  >
                    <Icon size={14} style={{ color: active ? '#60a5fa' : '#2a4060', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? '#dbeafe' : '#4a6580' }}>{label}</div>
                      <div style={{ fontSize: 8, color: '#1a2d3f' }}>{desc}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LAYOUT PRINCIPAL ─────────────────────────────────────────────────────────
export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Fechar drawer ao mudar de rota
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const { data: ticker } = useBtcTicker();
  const { price: wsPrice, connected: wsConnected } = useBtcPriceWs();
  // WebSocket é fonte primária; REST ticker é fallback; mock data é último recurso
  const btcPrice    = wsPrice ?? ticker?.mark_price    ?? btcFutures.mark_price;
  const btcDelta    = ticker?.oi_delta_pct  ?? btcFutures.oi_delta_pct;
  const btcIsLive   = wsConnected || ticker != null;
  const deltaPositive = btcDelta >= 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#070B14' }}>

      {/* ── SIDEBAR (desktop only) ─────────────────────────────────────────── */}
      {!isMobile && (
        <aside style={{
          width: collapsed ? 60 : 224,
          minWidth: collapsed ? 60 : 224,
          background: 'linear-gradient(180deg, #08101f 0%, #070B14 100%)',
          borderRight: '1px solid rgba(59,130,246,0.07)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1), min-width 0.24s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 50,
          position: 'fixed',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {/* Logo */}
          <div style={{
            padding: collapsed ? '16px 14px' : '16px 18px',
            borderBottom: '1px solid rgba(22,32,50,0.7)',
            display: 'flex', alignItems: 'center', gap: 10,
            minHeight: 60, flexShrink: 0,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(59,130,246,0.4), 0 0 40px rgba(124,58,237,0.15)',
            }}>
              <Bitcoin size={15} color="#fff" />
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{
                  fontSize: 13, fontWeight: 800, color: '#f1f5f9',
                  letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                  background: 'linear-gradient(90deg, #e2e8f0 0%, #93c5fd 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  CryptoWatch
                </div>
                <div style={{
                  fontSize: 8, color: '#1e3048',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.14em', whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                }}>
                  Institutional
                </div>
              </div>
            )}
          </div>

          {/* Data mode badge */}
          {!collapsed && (
            <div style={{ padding: '8px 18px 0', flexShrink: 0 }}>
              <span style={{
                fontSize: 8, fontFamily: 'JetBrains Mono, monospace',
                background: 'rgba(245,158,11,0.08)', color: '#92400e',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 4, padding: '2px 7px',
                letterSpacing: '0.1em', fontWeight: 700,
                textTransform: 'uppercase',
              }}>
                Mock Data
              </span>
            </div>
          )}

          {/* Nav */}
          <nav style={{ padding: '8px 10px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi} style={{ marginBottom: collapsed ? 4 : 2 }}>
                {!collapsed && group.label && (
                  <div style={{
                    fontSize: 8, fontWeight: 800, color: 'rgba(30,48,72,0.9)',
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    padding: '10px 12px 5px',
                    borderTop: gi > 0 ? '1px solid rgba(22,32,50,0.5)' : 'none',
                    marginTop: gi > 0 ? 4 : 0,
                  }}>
                    {group.label}
                  </div>
                )}
                {collapsed && gi > 0 && (
                  <div style={{ height: 1, background: 'rgba(22,32,50,0.6)', margin: '5px 6px' }} />
                )}
                {group.items.map(({ label, icon, page, desc }) => (
                  <NavItem
                    key={page}
                    label={label}
                    icon={icon}
                    page={page}
                    desc={desc}
                    active={currentPageName === page}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            ))}
          </nav>

          {/* Collapse button */}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              margin: '8px 10px 14px',
              padding: collapsed ? '9px' : '9px 12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(22,32,50,0.7)',
              color: '#2a4060',
              cursor: 'pointer',
              fontSize: 11,
              display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8,
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)';
              e.currentTarget.style.color = '#60a5fa';
              e.currentTarget.style.background = 'rgba(59,130,246,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(22,32,50,0.7)';
              e.currentTarget.style.color = '#2a4060';
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <><ChevronLeft size={13} /><span style={{ fontSize: 11 }}>Recolher</span></>}
          </button>
        </aside>
      )}

      {/* ── MAIN ──────────────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        marginLeft: isMobile ? 0 : (collapsed ? 60 : 224),
        transition: 'margin-left 0.24s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
        <header style={{
          height: 54,
          background: 'rgba(5,8,18,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(22,32,50,0.8)',
          display: 'flex', alignItems: 'center',
          padding: '0 18px',
          gap: 12,
          position: 'sticky', top: 0, zIndex: 40,
        }}>
          {/* Page title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#2a4060',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {currentPageName === 'Dashboard' ? 'Market Overview' : currentPageName}
            </div>
          </div>

          {/* Clock */}
          <LiveClock />

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: 'rgba(22,32,50,0.8)' }} />

          {/* BTC ticker */}
          <div
            className="topbar-btc"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.14)',
              borderRadius: 8, padding: '5px 12px',
            }}
          >
            <span style={{ fontSize: 11, color: '#2a4060', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>₿</span>
            <span style={{
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#60a5fa', fontWeight: 800,
              letterSpacing: '-0.02em',
            }}>
              ${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span style={{
              fontSize: 10,
              color: deltaPositive ? '#34d399' : '#f87171',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
            }}>
              {deltaPositive ? '+' : ''}{btcDelta.toFixed(2)}%
            </span>
          </div>

          {/* Live status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div
              className="live-dot"
              style={{ width: 6, height: 6, borderRadius: '50%', background: wsConnected ? '#10b981' : btcIsLive ? '#3b82f6' : '#f59e0b' }}
            />
            <span style={{
              fontSize: 9, color: wsConnected ? '#059669' : btcIsLive ? '#2563eb' : '#92400e',
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
              letterSpacing: '0.08em',
            }}>
              {wsConnected ? 'WS' : btcIsLive ? 'REST' : 'MOCK'}
            </span>
          </div>
        </header>

        {/* ── DEMO BANNER ─────────────────────────────────────────────── */}
        {DATA_MODE === 'mock' && (
          <div style={{
            background: 'rgba(245,158,11,0.09)',
            borderBottom: '1px solid rgba(245,158,11,0.2)',
            padding: '6px 18px',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 900, letterSpacing: '0.12em',
              fontFamily: 'JetBrains Mono, monospace',
              color: '#f59e0b',
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 4, padding: '2px 8px',
            }}>
              🧪 MODO DEMO
            </span>
            <span style={{ fontSize: 10, color: '#92400e', flex: 1 }}>
              Dados simulados — não tome decisões financeiras com base nestes valores.
            </span>
            <Link
              to={createPageUrl('DataSources')}
              style={{ fontSize: 10, color: '#d97706', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
            >
              Ver fontes →
            </Link>
          </div>
        )}

        {/* ── CONTENT ─────────────────────────────────────────────────────── */}
        <div className="page-content" style={{ flex: 1, padding: '20px 22px', overflowY: 'auto' }}>
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────────── */}
      {isMobile && (
        <nav className="bottom-nav">
          {BOTTOM_TABS.map(tab => {
            const Icon = tab.icon;
            const isDrawerTab = tab.page === null;
            const active = isDrawerTab ? drawerOpen : currentPageName === tab.page;
            return (
              <button
                key={tab.label}
                className={`bottom-nav-item${active ? ' active' : ''}`}
                onClick={() => {
                  if (isDrawerTab) {
                    setDrawerOpen(d => !d);
                  }
                }}
                {...(!isDrawerTab ? {
                  as: 'div',
                  onClick: undefined,
                } : {})}
              >
                {!isDrawerTab ? (
                  <Link
                    to={createPageUrl(tab.page)}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 3,
                      color: 'inherit', textDecoration: 'none',
                      width: '100%', height: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} />
                    <span>{tab.label}</span>
                  </Link>
                ) : (
                  <>
                    <Icon size={20} />
                    <span>{tab.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* ── MOBILE DRAWER ─────────────────────────────────────────────────── */}
      {isMobile && drawerOpen && (
        <MobileDrawer currentPageName={currentPageName} onClose={closeDrawer} />
      )}

      {/* ── DEBUG PANEL (flutuante, produção) ─────────────────────────────── */}
      <DebugPanel />
    </div>
  );
}
