import g from '../styles/shared.module.css';
import { cx } from '../lib/cx.js';

function Kpi({ label, value, sub, alert, color }) {
  return (
    <div className={g.kpi}>
      <div className={g.lab}>{label}</div>
      <div className={cx(g.val, alert && g.warn)} style={color ? { borderColor: color } : undefined}>
        {value}
      </div>
      {sub && <div className={g.sub}>{sub}</div>}
    </div>
  );
}

export default function KpiStrip({ items, cols }) {
  const style = cols
    ? { gridTemplateColumns: `repeat(${cols}, 1fr)` }
    : undefined;
  return (
    <div className={g.kpis} style={style}>
      {items.map((item) => (
        <Kpi key={item.label} {...item} />
      ))}
    </div>
  );
}
