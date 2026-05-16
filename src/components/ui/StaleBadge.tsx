import { WifiOff } from 'lucide-react';

interface Props {
  isStale: boolean;
  lastUpdated: Date | null;
  error?: string | null;
}

export function StaleBadge({ isStale, lastUpdated, error }: Props) {
  if (!isStale) return null;
  const time = lastUpdated
    ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';
  return (
    <span
      title={error ? `Erro: ${error}` : 'Dado do cache — API indisponível'}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-yellow-900/40 text-yellow-400 border border-yellow-700/40"
    >
      <WifiOff size={9} />
      CACHE {time}
    </span>
  );
}
