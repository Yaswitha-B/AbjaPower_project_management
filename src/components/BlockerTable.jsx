import { useState } from 'react';
import s from './BlockerTable.module.css';
import g from '../styles/shared.module.css';
import { cx } from '../lib/cx.js';
import { fmtDate, ownerTypeLabel } from '../lib/format.js';
import { ISSUE_STAGES, HIST_SOURCE } from '../lib/constants.js';

const PARTY_CLS   = { int: g.badgeInt, ext: g.badgeExt, com: g.badgeCom };
const STAGE_LABEL = Object.fromEntries(ISSUE_STAGES.map(s => [s.value, s.label]));

function PartyBadge({ type }) {
  return <span className={cx(g.badge, PARTY_CLS[type])}>{ownerTypeLabel[type] ?? type}</span>;
}

function StatusDot({ stage }) {
  const resolved = stage === 'resolved';
  return (
    <span className={s.sig}>
      <span className={cx(s.dot, resolved ? s.dGo : s.dStop)} />
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

function AgeBadge({ days }) {
  if (days == null) return <span style={{ color: 'var(--steel)' }}>—</span>;
  return <span className={s.ageBadge}>{days}d</span>;
}

function rowCls(issue) {
  return issue.stage === 'resolved' ? s.rowResolved : s.rowOpen;
}

// compact = executive view (fewer columns, no curator metadata)
export default function BlockerTable({ issues, showOwner = false, compact = false }) {
  const [hideResolved, setHideResolved] = useState(true);

  if (!issues?.length) {
    return (
      <div className={s.emptyState}>
        <strong>No open issues</strong>
        All blockers resolved or none raised yet.
      </div>
    );
  }

  const open     = issues.filter(b => b.stage !== 'resolved');
  const resolved = issues.filter(b => b.stage === 'resolved');
  const displayed = hideResolved ? open : issues;

  return (
    <>
      <div className={s.tableControls}>
        {resolved.length > 0 && (
          <button
            className={cx(s.toggleBtn, !hideResolved && s.toggleBtnOn)}
            onClick={() => setHideResolved(v => !v)}
          >
            {hideResolved ? `Show ${resolved.length} resolved` : `Hide resolved (${resolved.length})`}
          </button>
        )}
        <span style={{ fontSize: 11, color: 'var(--steel)' }}>
          {open.length} open{resolved.length > 0 ? ` · ${resolved.length} resolved` : ''}
        </span>
      </div>

      {displayed.length === 0 ? (
        <div className={s.emptyState}>
          <strong>No open issues</strong>
          All blockers resolved or none raised yet.
        </div>
      ) : (
        <div className={g.bkWrap}>
          <table className={g.bk}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Ref</th>
                <th>Description</th>
                {showOwner && <th>Responsible</th>}
                {showOwner && <th>Party</th>}
                <th className={g.num}>Raised</th>
                {!compact && <th className={g.num}>Last seen</th>}
                <th className={g.num}>Age</th>
                {!compact && <th className={g.num} title="Times reported">Seen</th>}
                <th style={{ minWidth: 100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((b) => (
                <tr key={b.id} className={rowCls(b)}>
                  <td className={g.bkRef}>
                    {b.id}
                    {b.recur && <span className={g.recurMark} title="Recurred">↻</span>}
                    {b.source === HIST_SOURCE && <span className={s.hist}>hist</span>}
                  </td>
                  <td className={g.bkDesc}>{b.description}</td>
                  {showOwner && <td className={g.bkOwner}>{b.owner || <span style={{ color: 'var(--steel)' }}>—</span>}</td>}
                  {showOwner && <td><PartyBadge type={b.owner_type} /></td>}
                  <td className={cx(g.num, g.bkDate)}>{fmtDate(b.first_sighting ?? b.raised_date)}</td>
                  {!compact && <td className={cx(g.num, g.bkDate)}>{fmtDate(b.last_sighting ?? b.raised_date)}</td>}
                  <td className={g.num}><AgeBadge days={b.age_days} /></td>
                  {!compact && <td className={g.num} style={{ fontSize: 12 }}>{b.sighting_count ?? 1}×</td>}
                  <td><StatusDot stage={b.stage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={s.legend}>
        <span><span className={cx(s.dot, s.dStop)} />Open</span>
        <span><span className={cx(s.dot, s.dGo)} />Resolved</span>
        {!compact && <span>↻ recurred</span>}
        {!compact && <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>hist = seeded data</span>}
        <span style={{ color: 'var(--steel)' }}>Age = days since raised</span>
      </div>
    </>
  );
}
