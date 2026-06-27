import { fmtNumber } from '../lib/format.js';

export default function BarChart({ rows, gradient = 'linear-gradient(90deg,var(--blue2),var(--blue))', onRowClick }) {
  if (!rows?.length) {
    return <p style={{ color: 'var(--steel)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>No data yet</p>;
  }

  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <div>
      {rows.map(([label, value]) => (
        <div
          key={label}
          onClick={onRowClick ? () => onRowClick(label) : undefined}
          style={{
            display: 'grid', gridTemplateColumns: '148px 1fr 48px',
            alignItems: 'center', gap: 10, margin: '7px 0', fontSize: 12.5,
            cursor: onRowClick ? 'pointer' : 'default',
            borderRadius: 4, padding: '2px 4px', marginLeft: -4,
            transition: 'background .1s',
          }}
          onMouseEnter={onRowClick ? e => e.currentTarget.style.background = 'var(--field)' : undefined}
          onMouseLeave={onRowClick ? e => e.currentTarget.style.background = '' : undefined}
        >
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
          <div style={{ height: 14, borderRadius: 3, background: gradient, width: `${Math.max(6, (100 * value) / max)}%` }} />
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--steel)', textAlign: 'right' }}>
            {fmtNumber(value)}
          </div>
        </div>
      ))}
    </div>
  );
}
