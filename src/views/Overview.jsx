import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchPortfolio } from '../api/client.js';
import KpiStrip from '../components/KpiStrip.jsx';
import BarChart from '../components/BarChart.jsx';
import Eyebrow from '../components/Eyebrow.jsx';
import { fmtNumber, fmtDate } from '../lib/format.js';
import g from '../styles/shared.module.css';
import s from './Overview.module.css';
import { cx } from '../lib/cx.js';

function LastReportBadge({ date, status }) {
  if (!date) return <span style={{ color: 'var(--steel)', fontSize: 11 }}>—</span>;
  const days   = Math.floor((new Date() - new Date(date)) / 86400000);
  const active = status === 'active';
  const color  = !active ? 'var(--steel)'
    : days > 7 ? 'var(--stop)'
    : days > 3 ? 'var(--warn)'
    : 'var(--go)';
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color }}>
      {fmtDate(date)}
      <span style={{ color: 'var(--steel)', marginLeft: 4 }}>({days}d ago)</span>
    </span>
  );
}

export default function Overview() {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  const navigate          = useNavigate();

  useEffect(() => {
    fetchPortfolio()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className={g.error}>{error}</div>;
  if (!data) return <div className={g.loading}>Loading portfolio…</div>;

  const { projects } = data;

  if (!projects.length) {
    return (
      <section className={g.view}>
        <div className={g.wrap} style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ color: 'var(--steel)', fontSize: 15, marginBottom: 20 }}>No projects yet.</p>
          <Link to="/projects/new">
            <button className={g.saveBtn} style={{ width: 'auto', padding: '10px 28px', marginTop: 0 }}>
              + Add first project
            </button>
          </Link>
        </div>
      </section>
    );
  }

  const totalCrewDays  = projects.reduce((sum, p) => sum + Number(p.total_man_days ?? 0), 0);
  const openIssues     = projects.reduce((sum, p) => sum + Number(p.open_blockers ?? p.distinct_blockers ?? 0), 0);
  const activeProjects = projects.filter(p => p.status !== 'closed').length;

  // Stalest report across all projects
  const allDates   = projects.map(p => p.last_report_date).filter(Boolean);
  const latestDate = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : null;
  const latestDays = latestDate ? Math.floor((new Date() - new Date(latestDate)) / 86400000) : null;

  const portfolioKpis = [
    {
      label: 'Crew-Days Logged',
      value: fmtNumber(totalCrewDays),
      sub: 'total person-days on site, all projects',
    },
    {
      label: 'Open Issues',
      value: openIssues,
      sub: openIssues === 0 ? 'no blockers outstanding' : 'pending resolution across all sites',
      alert: openIssues > 0,
    },
    {
      label: 'Active Projects',
      value: activeProjects,
      sub: `of ${projects.length} total being monitored`,
    },
    {
      label: 'Last Field Report',
      value: latestDate ? fmtDate(latestDate) : '—',
      sub: latestDays != null
        ? latestDays === 0 ? 'today — data is fresh'
          : latestDays === 1 ? 'yesterday'
          : `${latestDays} days ago`
        : 'no reports yet',
      alert: latestDays != null && latestDays > 7,
    },
  ];

  // Sort by most crew days for the scorecard
  const sorted = [...projects].sort((a, b) => Number(b.total_man_days ?? 0) - Number(a.total_man_days ?? 0));

  const goToProject = (name) => {
    const p = projects.find(x => x.name === name);
    if (p) navigate(`/projects/${p.id}`);
  };

  return (
    <section className={g.view}>
      <div className={g.wrap}>
        <KpiStrip items={portfolioKpis} cols={4} />

        <Eyebrow>Programme scorecard</Eyebrow>
        <div className={g.card} style={{ padding: '0 0 4px', marginBottom: 30, overflow: 'hidden' }}>
          <div className={s.tableWrap}><table className={s.tbl}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 16 }}>Project</th>
                <th className={g.num}>Crew-Days</th>
                <th className={g.num}>Daily avg</th>
                <th className={g.num}>Last report</th>
                <th className={g.num}>Open issues</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className={s.row} onClick={() => navigate(`/projects/${p.id}`)}>
                  <td style={{ paddingLeft: 16 }}>
                    <div className={s.pname}>{p.name}</div>
                    <div className={s.pdisc}>{p.discipline}</div>
                  </td>
                  <td className={g.num} style={{ fontWeight: 600 }}>{fmtNumber(p.total_man_days ?? 0)}</td>
                  <td className={g.num} style={{ color: 'var(--steel)', fontSize: 12 }}>{p.avg_crew ?? '—'}</td>
                  <td className={g.num} style={{ paddingRight: 12 }}>
                    <LastReportBadge date={p.last_report_date} status={p.status} />
                  </td>
                  <td className={g.num}>
                    {Number(p.open_blockers ?? p.distinct_blockers ?? 0) > 0
                      ? <span style={{ color: 'var(--stop)', fontWeight: 700 }}>{p.open_blockers ?? p.distinct_blockers}</span>
                      : <span style={{ color: 'var(--go)', fontSize: 11 }}>✓</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

        <div className={cx(g.grid, g.two)} style={{ marginBottom: 16 }}>
          <div className={g.card}>
            <div className={g.caption}>Crew-days on site — click a project to drill in</div>
            <BarChart
              rows={sorted.map((p) => [p.name, Number(p.total_man_days ?? 0)])}
              gradient="linear-gradient(90deg,var(--blue2),var(--blue))"
              onRowClick={goToProject}
            />
            <p className={g.note} style={{ marginTop: 12 }}>
              Each bar is total person-days reported since project start.
            </p>
          </div>
          <div className={g.card}>
            <div className={g.caption}>Open issues by project — click to drill in</div>
            <BarChart
              rows={sorted.map((p) => [p.name, Number(p.open_blockers ?? p.distinct_blockers ?? 0)])}
              gradient="linear-gradient(90deg,var(--warn),var(--orange))"
              onRowClick={goToProject}
            />
            <p className={g.note} style={{ marginTop: 12 }}>
              Unresolved blockers only. A shorter bar is better.
            </p>
          </div>
        </div>

        <p style={{ color: 'var(--steel)', fontSize: 11, marginTop: 4 }}>
          Last report date colour-coding applies to active projects only: green = recent, amber = 3+ days, red = 7+ days stale.
        </p>
      </div>
    </section>
  );
}
