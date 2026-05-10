import React from 'react';

export interface DataFreshnessIndicatorProps {
  dataUpdatedAt: number;
  isFetching?:   boolean;
  source?:       string;
  compact?:      boolean;
}

const containerStyle: React.CSSProperties = {
  background:    'rgba(0,0,0,0.3)',
  border:        '1px solid #162032',
  borderRadius:  4,
  padding:       '2px 8px',
  fontSize:      10,
  fontFamily:    'JetBrains Mono, monospace',
  fontWeight:    600,
  display:       'inline-flex',
  alignItems:    'center',
  gap:           4,
  cursor:        'default',
};

function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts));
}

function formatShort(ts: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export function DataFreshnessIndicator({
  dataUpdatedAt,
  isFetching = false,
  source,
  compact = false,
}: DataFreshnessIndicatorProps): React.ReactElement {
  const isLive = dataUpdatedAt > Date.now() - 5 * 60 * 1000;
  const title   = `Última atualização em: ${formatDateTime(dataUpdatedAt)}${source ? ` · ${source}` : ''}`;

  if (isFetching) {
    return (
      <span style={containerStyle} title={title}>
        <span
          style={{
            display:       'inline-block',
            width:         8,
            height:        8,
            borderRadius:  '50%',
            border:        '2px solid #3b82f6',
            borderTopColor: 'transparent',
            animation:     'spin 0.7s linear infinite',
          }}
        />
        {!compact && <span style={{ color: '#94a3b8' }}>Atualizando...</span>}
      </span>
    );
  }

  if (isLive) {
    return (
      <span style={containerStyle} title={title}>
        <span style={{ color: '#10b981' }}>●</span>
        {!compact && <span style={{ color: '#10b981' }}>Live</span>}
      </span>
    );
  }

  return (
    <span style={containerStyle} title={title}>
      <span style={{ color: '#f59e0b' }}>○</span>
      {!compact && (
        <span style={{ color: '#f59e0b' }}>
          Cache · {formatShort(dataUpdatedAt)}
        </span>
      )}
    </span>
  );
}
