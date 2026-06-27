const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const fmtNumber = (n) => Number(n).toLocaleString('en-IN');

export const fmtDate = (iso) => {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
};

export const fmtMonthYear = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${MN[d.getMonth()]}'${String(d.getFullYear()).slice(2)} `;
};

export const trendLabel = (monthlyValues) => {
  const valid = monthlyValues.filter((v) => v != null);
  if (valid.length < 2) return 'steady';
  const first = valid[0], last = valid[valid.length - 1];
  if (last > first * 1.1) return 'up';
  if (last < first * 0.9) return 'down';
  return 'steady';
};

export const ownerTypeLabel = {
  int: 'Internal · self-owned',
  ext: 'External · client/civil',
  com: 'Compliance / coord.',
};
