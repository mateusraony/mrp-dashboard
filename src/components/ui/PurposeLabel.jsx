/**
 * PurposeLabel — rótulo educacional padronizado "📌 Para que serve:"
 * Usado em todas as páginas para explicar o propósito de cada seção.
 */
export default function PurposeLabel({ text, mb = 8, mt = 2 }) {
  return (
    <div style={{ fontSize: 10, color: '#475569', marginBottom: mb, marginTop: mt, lineHeight: 1.6 }}>
      <span style={{ color: '#94a3b8', fontWeight: 700 }}>📌 Para que serve:</span>{' '}
      {text}
    </div>
  );
}
