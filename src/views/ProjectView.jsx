import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProject } from '../api/client.js';
import KpiStrip from '../components/KpiStrip.jsx';
import LineChart from '../components/LineChart.jsx';
import BarChart from '../components/BarChart.jsx';
import BlockerTable from '../components/BlockerTable.jsx';
import Eyebrow from '../components/Eyebrow.jsx';
import { fmtNumber, fmtDate, fmtMonthYear, trendLabel } from '../lib/format.js';
import g from '../styles/shared.module.css';
import s from './ProjectView.module.css';
import { cx } from '../lib/cx.js';
import { REPORT_WARN_DAYS, REPORT_STOP_DAYS } from '../lib/constants.js';

function DetailTabs({ tabs, active, onChange }) {
  return (
    <div className={g.subtabs}>
      {tabs.map((t) => (
        <button key={t} className={cx(g.pill, active === t && g.on)} onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

const CATEGORY_LABEL = { design: 'Design', management: 'Mgmt', customer: 'Customer', sub_contractor: 'Sub-contractor', other: 'Other' };
const CATEGORY_BADGE = { design: g.badgeDesign, management: g.badgeMgmt, customer: g.badgeCustomer, sub_contractor: g.badgeSc, other: g.badgeOther };
const TYPE_LABEL     = { internal: 'Internal', customer: 'Customer', supplier_contractor: 'Supplier / Contractor' };
const TYPE_BADGE     = { internal: g.badgeInternal, customer: g.badgeCustomer, supplier_contractor: g.badgeSc };

function TeamView({ contacts }) {
  if (!contacts?.length) {
    return <p style={{ color: 'var(--steel)', fontSize: 13 }}>No contacts added yet. <Link to="edit" style={{ color: 'var(--blue)' }}>Edit project</Link> to add people.</p>;
  }
  return (
    <div className={s.teamGrid}>
      {contacts.map((c) => (
        <div key={c.id} className={s.teamCard}>
          <div className={s.teamCardEntity}>{c.entity}</div>
          {c.contact_person && <div className={s.teamCardPerson}>{c.contact_person}</div>}
          <div className={s.teamCardContact}>
            {c.contact_number && <div>{c.contact_number}</div>}
            {c.email && <div>{c.email}</div>}
          </div>
          <div className={s.teamCardBadges}>
            <span className={cx(g.badge, TYPE_BADGE[c.party_type])}>{TYPE_LABEL[c.party_type] ?? c.party_type}</span>
            <span className={cx(g.badge, CATEGORY_BADGE[c.category])}>{CATEGORY_LABEL[c.category] ?? c.category}</span>
          </div>
        </div>
      ))}
    </div>
  );
}


const TABS = ['Summary', 'Crew & Activity', 'Issues', 'Team'];

export default function ProjectView() {
  const { id } = useParams();
  const [data, setData]                   = useState(null);
  const [error, setError]                 = useState(null);
  const [tab, setTab]                     = useState('Summary');
  const [showAllActs, setShowAllActs]     = useState(false);
  const [showAllTowers, setShowAllTowers] = useState(false);

  useEffect(() => {
    setData(null);
    setTab('Summary');
    fetchProject(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className={g.error}>{error}</div>;
  if (!data)  return <div className={g.loading}>Loading {id}…</div>;

  const { summary, trend, activities, towers, issues, contacts } = data;

  const trendRows      = trend?.map((t) => [fmtMonthYear(t.month), t.man_days]) ?? [];
  const months         = trendRows.map((r) => r[0]);
  const manDaysByMonth = trendRows.map((r) => r[1]);

  const openCount     = summary.open_blockers ?? 0;
  const closedCount   = (summary.distinct_blockers ?? 0) - openCount;

  const overviewKpis = [
    {
      label: 'Report Days on File',
      value: summary.reported_days ?? 0,
      sub: 'unique days with a field report on file',
    },
    {
      label: 'Total Crew-Days',
      value: fmtNumber(summary.total_man_days ?? 0),
      sub: (() => {
        const trend = trendLabel(manDaysByMonth);
        const arrow = trend === 'up' ? ' ▲ rising' : trend === 'down' ? ' ▼ falling' : '';
        return `avg ${summary.avg_crew ?? '—'}/day · peak ${summary.peak_crew ?? '—'}${arrow}`;
      })(),
    },
    {
      label: 'Open Issues',
      value: openCount,
      sub: openCount === 0 ? 'all clear' : `${closedCount} resolved`,
      alert: openCount > 0,
    },
  ];

  const displayedActivities = showAllActs   ? (activities ?? []) : (activities ?? []).slice(0, 8);
  const displayedTowers     = showAllTowers ? (towers ?? [])     : (towers ?? []).slice(0, 8);

  return (
    <section className={g.view}>
      <div className={g.wrap}>

        {/* ── Project header ── */}
        <div className={s.phead}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className={g.title}>{summary.name}</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
              <span className={s.pheadMeta}>{summary.discipline}</span>
              {summary.status && (
                <span className={cx(g.badge,
                  summary.status === 'active'   ? g.badgeInternal :
                  summary.status === 'inactive' ? g.badgeExt      : g.badgeMgmt
                )}>{summary.status}</span>
              )}
              {summary.start_date && (
                <span className={s.pheadMeta}>
                  {fmtDate(summary.start_date)}
                  {summary.end_date
                    ? ` → ${fmtDate(summary.end_date)}`
                    : summary.status === 'active'
                      ? ' → ongoing'
                      : summary.last_report_date
                        ? ` → last report ${fmtDate(summary.last_report_date)}`
                        : ''}
                </span>
              )}
            </div>
            {summary.last_report_date && (() => {
              const daysAgo = Math.floor((new Date() - new Date(summary.last_report_date)) / 86400000);
              const active  = summary.status === 'active';
              const color   = !active ? 'var(--steel)'
                : daysAgo > REPORT_STOP_DAYS ? 'var(--stop)'
                : daysAgo > REPORT_WARN_DAYS ? 'var(--warn)'
                : 'var(--steel)';
              return (
                <div style={{ marginTop: 8, fontSize: 12, color }}>
                  Last field report: <strong>{fmtDate(summary.last_report_date)}</strong>
                  {daysAgo === 0 ? ' — today' : daysAgo === 1 ? ' — yesterday' : ` — ${daysAgo} days ago`}
                  {active && daysAgo > REPORT_STOP_DAYS && ' ⚠ stale'}
                </div>
              );
            })()}
          </div>
          <div style={{ flexShrink: 0 }}>
            <Link to={`/projects/${id}/edit`} style={{ display: 'inline-block' }}>
              <button className={g.pill} style={{ fontSize: 11, padding: '5px 12px' }}>Edit project</button>
            </Link>
          </div>
        </div>

        <DetailTabs tabs={TABS} active={tab} onChange={setTab} />

        {/* ── Summary tab ── */}
        {tab === 'Summary' && (
          <div>
            <KpiStrip items={overviewKpis} cols={3} />
            <div className={cx(g.grid, g.two)}>
              <div className={g.card}>
                <div className={g.caption}>Crew-days deployed — monthly</div>
                <LineChart values={manDaysByMonth} labels={months} color="var(--blue)" />
                <p className={g.note} style={{ marginTop: 8 }}>
                  Each point is total person-days reported that month.
                </p>
              </div>
              <div className={g.card}>
                <div className={g.caption}>Who owns resolution</div>
                <div className={g.kpis} style={{ gridTemplateColumns: 'repeat(3,1fr)', margin: '8px 0 0', border: 'none', background: 'none' }}>
                  {[
                    { label: 'Internal',   type: 'int', color: 'var(--stop)' },
                    { label: 'External',   type: 'ext', color: 'var(--warn)' },
                    { label: 'Compliance', type: 'com', color: 'var(--blue)' },
                  ].map(({ label, type, color }) => {
                    const typeIssues = (issues ?? []).filter(i => i.owner_type === type);
                    const open       = typeIssues.filter(i => i.stage !== 'resolved').length;
                    const resolved   = typeIssues.filter(i => i.stage === 'resolved').length;
                    const total = open + resolved;
                    return (
                      <div key={type} className={g.kpi} style={{ background: 'var(--field)', borderRadius: 6 }}>
                        <div className={g.val} style={{ borderColor: open > 0 ? color : 'var(--go)', fontSize: 24 }}>{total}</div>
                        <div className={g.sub}>{label}</div>
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 700, color: open > 0 ? color : 'var(--steel)' }}>{open}</span>
                          <span style={{ fontSize: 10, color: 'var(--steel)' }}>unresolved</span>
                          <span style={{ fontSize: 11, color: 'var(--line)', margin: '0 2px' }}>·</span>
                          <span style={{ fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--go)' }}>{resolved}</span>
                          <span style={{ fontSize: 10, color: 'var(--steel)' }}>resolved</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Crew & Activity tab ── */}
        {tab === 'Crew & Activity' && (
          <div>
            <Eyebrow>Crew deployment over time</Eyebrow>
            <div className={g.card} style={{ marginBottom: 16 }}>
              <div className={g.caption}>Person-days on site — by month</div>
              <LineChart values={manDaysByMonth} labels={months} color="var(--blue)" />
            </div>
            <div className={cx(g.grid, g.two)}>
              <div className={g.card}>
                <div className={g.caption}>Activity mix — where effort is going</div>
                {displayedActivities.length === 0
                  ? <p style={{ color: 'var(--steel)', fontSize: 13 }}>No activity data yet.</p>
                  : <BarChart rows={displayedActivities.map((a) => [a.activity, Number(a.man_days)])} />
                }
                {(activities ?? []).length > 8 && (
                  <button className={g.pill} style={{ marginTop: 10, fontSize: 12 }} onClick={() => setShowAllActs(v => !v)}>
                    {showAllActs ? 'Show top 8' : `Show all ${activities.length} activities`}
                  </button>
                )}
              </div>
              <div className={g.card}>
                <div className={g.caption}>Effort by zone — where crew is deployed</div>
                {displayedTowers.length === 0
                  ? <p style={{ color: 'var(--steel)', fontSize: 13 }}>No zone data yet.</p>
                  : <BarChart rows={displayedTowers.map((t) => [t.tower, Number(t.man_days)])} />
                }
                {(towers ?? []).length > 8 && (
                  <button className={g.pill} style={{ marginTop: 10, fontSize: 12 }} onClick={() => setShowAllTowers(v => !v)}>
                    {showAllTowers ? 'Show top 8' : `Show all ${towers.length} zones`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Issues tab ── */}
        {tab === 'Issues' && (() => {
          const ownerTypes = [
            { label: 'Internal',   type: 'int', color: 'var(--stop)' },
            { label: 'External',   type: 'ext', color: 'var(--warn)' },
            { label: 'Compliance', type: 'com', color: 'var(--blue)' },
          ].map(({ label, type, color }) => {
            const subset   = (issues ?? []).filter(i => i.owner_type === type);
            const open     = subset.filter(i => i.stage !== 'resolved').length;
            const resolved = subset.filter(i => i.stage === 'resolved').length;
            return { label, type, color, open, resolved, total: open + resolved };
          });

          return (
            <div>
              {/* Row 1 — compact open / resolved count */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                background: 'var(--card)', border: '1px solid var(--line)',
                borderRadius: 8, padding: '10px 18px', marginBottom: 14,
              }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 22, color: openCount > 0 ? 'var(--stop)' : 'var(--steel)' }}>{openCount}</span>
                  <span style={{ fontSize: 11, color: 'var(--steel)' }}>open</span>
                </span>
                <span style={{ color: 'var(--line)', fontSize: 16 }}>·</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 22, color: 'var(--go)' }}>{closedCount}</span>
                  <span style={{ fontSize: 11, color: 'var(--steel)' }}>resolved</span>
                </span>
              </div>

              {/* Row 2 — ownership breakdown */}
              <div className={g.kpis} style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
                {ownerTypes.map(({ label, type, color, open, resolved, total }) => (
                  <div key={type} className={g.kpi}>
                    <div className={g.val} style={{ borderColor: open > 0 ? color : 'var(--go)', fontSize: 24 }}>{total}</div>
                    <div className={g.sub}>{label}</div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 700, color: open > 0 ? color : 'var(--steel)' }}>{open}</span>
                      <span style={{ fontSize: 10, color: 'var(--steel)' }}>unresolved</span>
                      <span style={{ fontSize: 11, color: 'var(--line)', margin: '0 2px' }}>·</span>
                      <span style={{ fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--go)' }}>{resolved}</span>
                      <span style={{ fontSize: 10, color: 'var(--steel)' }}>resolved</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={g.card}>
                <div className={g.caption}>Issue register</div>
                <BlockerTable
                  issues={[...(issues ?? [])].sort((a, b) => {
                    if (a.stage === 'resolved' && b.stage !== 'resolved') return 1;
                    if (a.stage !== 'resolved' && b.stage === 'resolved') return -1;
                    return new Date(b.raised_date) - new Date(a.raised_date);
                  })}
                  showOwner
                  compact
                />
              </div>
            </div>
          );
        })()}

        {tab === 'Team' && (
          <div className={g.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className={g.caption} style={{ margin: 0 }}>People in loop</div>
              <Link to={`/projects/${id}/edit`}>
                <button className={g.pill} style={{ fontSize: 11, padding: '4px 10px' }}>Edit contacts</button>
              </Link>
            </div>
            <TeamView contacts={contacts} />
          </div>
        )}
      </div>
    </section>
  );
}
