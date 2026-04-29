import { ModeBadge, GradeBadge } from './DataBadge';
import { DATA_MODE } from '@/lib/env';

export default function SectionHeader({ title, subtitle, mode = DATA_MODE, grade = undefined, icon = undefined, children = undefined, accent = undefined }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: 16, flexWrap: 'wrap', gap: 8,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <span style={{
              fontSize: 16,
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: accent ? `${accent}18` : 'rgba(59,130,246,0.1)',
              border: `1px solid ${accent ? `${accent}30` : 'rgba(59,130,246,0.2)'}`,
              borderRadius: 7,
              flexShrink: 0,
            }}>{icon}</span>
          )}
          <h2 style={{
            fontSize: 15, fontWeight: 700, color: '#e2e8f0',
            letterSpacing: '-0.02em', margin: 0,
          }}>{title}</h2>
          {mode && <ModeBadge mode={mode} />}
          {grade && <GradeBadge grade={grade} />}
        </div>
        {subtitle && (
          <p style={{
            fontSize: 11, color: '#475569', marginTop: 4,
            marginLeft: icon ? 36 : 0, lineHeight: 1.4,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}