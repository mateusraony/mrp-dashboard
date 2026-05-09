/**
 * DisabledModuleBanner — exibido quando um módulo está desativado em Configurações.
 */
export function DisabledModuleBanner({ moduleName }) {
  return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      background: 'rgba(7,11,20,0.6)', borderRadius: 12,
      border: '1px dashed rgba(30,48,72,0.7)', margin: '24px 0',
    }}>
      <div style={{ fontSize: 22, marginBottom: 12, color: '#1e3048' }}>⊘</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
        Módulo{' '}
        <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
          {moduleName}
        </span>{' '}
        desativado
      </div>
      <div style={{ fontSize: 11, color: '#374151' }}>
        Ative em{' '}
        <a href="/Settings" style={{ color: '#3b82f6', textDecoration: 'none' }}>
          Configurações → Módulos
        </a>
      </div>
    </div>
  );
}
