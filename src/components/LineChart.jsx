const W = 560, H = 150, PL = 34, PR = 12, PT = 14, PB = 24;

export default function LineChart({ values, labels, color = 'var(--blue)' }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v != null);

  if (pts.length < 2) {
    return (
      <p style={{ color: 'var(--steel)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
        No data yet
      </p>
    );
  }

  const max = Math.max(...pts.map((p) => p.v), 1);
  const xOf = (i) => PL + (W - PL - PR) * (i / (labels.length - 1));
  const yOf = (v) => PT + (H - PT - PB) * (1 - v / max);

  const gridLines = [0, 0.5, 1].map((f) => {
    const val = max * f, gy = yOf(val);
    return (
      <g key={f}>
        <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="var(--line)" />
        <text x={PL - 6} y={gy + 3} textAnchor="end" fontSize={9} fill="var(--steel)" fontFamily="var(--mono)">
          {Math.round(val)}
        </text>
      </g>
    );
  });

  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${xOf(p.i).toFixed(1)} ${yOf(p.v).toFixed(1)}`).join(' ');
  const area = `${d} L ${xOf(pts.at(-1).i).toFixed(1)} ${yOf(0)} L ${xOf(pts[0].i).toFixed(1)} ${yOf(0)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {gridLines}
      <path d={area} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.2} />
      {pts.map((p) => (
        <circle key={p.i} cx={xOf(p.i).toFixed(1)} cy={yOf(p.v).toFixed(1)} r={4} fill={color} style={{ cursor: 'default' }}>
          <title>{labels[p.i]}: {p.v} crew-days</title>
        </circle>
      ))}
      {labels.map((l, i) => (
        <text key={i} x={xOf(i)} y={H - 7} textAnchor="middle" fontSize={9.5} fill="var(--steel)" fontFamily="var(--mono)">
          {l}
        </text>
      ))}
    </svg>
  );
}
