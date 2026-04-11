/**
 * errorBoundary.tsx — Global Error Boundary
 * Captura erros de render em qualquer child, exibe fallback elegante.
 * Uso: envolver <App /> ou seções críticas.
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Fallback customizado (opcional). Recebe o erro. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Fase 3+: enviar para Supabase / Sentry
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) return children;

    if (fallback) return fallback(error, this.reset);

    return <DefaultErrorFallback error={error} reset={this.reset} />;
  }
}

// ─── Default fallback UI ──────────────────────────────────────────────────────
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 480,
        background: 'linear-gradient(135deg, #0f1c2e 0%, #111827 100%)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 16, padding: '32px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <AlertTriangle size={24} color="#ef4444" />
        </div>

        <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>
          Erro de Renderização
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 20, lineHeight: 1.6 }}>
          Um componente falhou ao carregar. O erro foi registrado.
        </div>

        <div style={{
          background: '#070B14', border: '1px solid #162032',
          borderRadius: 8, padding: '10px 14px',
          marginBottom: 20, textAlign: 'left',
        }}>
          <div style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: '#ef4444', lineHeight: 1.6, wordBreak: 'break-word',
          }}>
            {error.message}
          </div>
        </div>

        <button
          onClick={reset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 8,
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.3)',
            color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
