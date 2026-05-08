// StaleIndicator — exibe ? âmbar quando dado é antigo ou ainda não disponível
// Props:
//   lastUpdatedAt — timestamp em ms ou string ISO (null/undefined = nunca recebido)
//   size          — tamanho da fonte em px (padrão 10)

export function StaleIndicator({ lastUpdatedAt, size = 10 }) {
  const timeStr = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : null;
  const title = timeStr
    ? `Última atualização: ${timeStr}`
    : 'Aguardando primeiro dado...';

  return (
    <span
      title={title}
      style={{
        fontSize: size,
        color: '#f59e0b',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
        cursor: 'help',
        marginLeft: 3,
        verticalAlign: 'super',
        lineHeight: 1,
      }}
    >?</span>
  );
}
