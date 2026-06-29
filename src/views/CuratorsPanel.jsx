import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllMis, fetchAllIssues,
  fetchUnverifiedMis, fetchUnverifiedIssues,
  fetchProject, saveRecord,
} from '../api/client.js';
import { fmtDate } from '../lib/format.js';
import { CURATOR_KEY, ISSUE_STAGES, ISSUE_OWNER_TYPES, STAGE_COLORS } from '../lib/constants.js';
import SearchSelect from '../components/SearchSelect.jsx';
import g from '../styles/shared.module.css';
import s from './CuratorsPanel.module.css';
import { cx } from '../lib/cx.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

function VerChip({ row }) {
  if (!row) return null;
  if (!row.verified_at) return <span className={cx(s.verChip, s.verPending)}>⏳ Unverified</span>;
  return <span className={cx(s.verChip, s.verVerified)}>✓ Verified{row.verified_by ? ` · ${row.verified_by}` : ''}</span>;
}

function statusColor(it) {
  return it.verified_at ? 'var(--go)' : 'var(--orange)';
}

// Quick-tap row of buttons (stage, party type).
// options: ISSUE_STAGES or ISSUE_OWNER_TYPES from constants — { value, label }
function QuickBtns({ options, value, onChange, colorMap }) {
  return (
    <div className={s.quickBtns}>
      {options.map(({ value: v, label: l }) => {
        const active = v === value;
        const color  = colorMap?.[v];
        return (
          <button
            key={v}
            type="button"
            className={cx(s.quickBtn, active && s.quickBtnOn)}
            style={active && color ? { background: color, borderColor: color } : undefined}
            onClick={() => !active && onChange(v)}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

// ── MIS detail (always editable) ──────────────────────────────────────────────

function ManpowerDetail({ detail }) {
  if (!detail || typeof detail !== 'object') return null;
  const entries = Object.entries(detail).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return null;
  return (
    <div className={s.mpDetail}>
      {entries.map(([role, count]) => (
        <span key={role} className={s.mpChip}>
          <strong>{count}</strong> {role}
        </span>
      ))}
    </div>
  );
}

function ActivityTable({ activities }) {
  if (!activities.length) return <p style={{ color: 'var(--steel)', fontSize: 12.5, margin: '6px 0' }}>No activities recorded.</p>;
  return (
    <table className={s.actTable}>
      <thead>
        <tr>
          <th>Activity</th>
          <th>Zone</th>
          <th>Area</th>
        </tr>
      </thead>
      <tbody>
        {activities.filter(a => a.activity).map((a, i) => (
          <tr key={i}>
            <td className={s.actMain}>{a.activity}</td>
            <td>{a.tower || <span style={{ color: 'var(--line)' }}>—</span>}</td>
            <td>{a.area || <span style={{ color: 'var(--line)' }}>—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MisDetail({ row, projectConfig, onVerified, onPrev, onNext, idx, total, curatorName }) {
  const [date, setDate]       = useState(row.date?.slice(0, 10) ?? '');
  const [pkg, setPkg]         = useState(row.package ?? '');
  const [manpower, setMp]     = useState(row.manpower_total ?? 0);
  const [reporter, setRep]    = useState(row.reported_by ?? '');
  const [activities, setActs] = useState(
    (Array.isArray(row.activities) ? row.activities : []).map(a => ({
      activity: a.activity ?? '', tower: a.tower ?? '', area: a.area ?? '',
    }))
  );
  const [editActs, setEditActs] = useState(false);
  const [zones, setZones]       = useState(projectConfig?.towers ?? []);
  const [acts2, setActTypes]    = useState(projectConfig?.activity_types ?? []);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    setDate(row.date?.slice(0, 10) ?? '');
    setPkg(row.package ?? '');
    setMp(row.manpower_total ?? 0);
    setRep(row.reported_by ?? '');
    setActs((Array.isArray(row.activities) ? row.activities : []).map(a => ({
      activity: a.activity ?? '', tower: a.tower ?? '', area: a.area ?? '',
    })));
    setEditActs(false); setError(''); setSaved(false);
  }, [row.id]);

  const addRow = () => setActs(a => [...a, { activity: '', tower: '', area: '' }]);
  const updRow = (i, v) => setActs(a => a.map((r, j) => j === i ? v : r));
  const rmRow  = (i) => setActs(a => a.filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await saveRecord({
        type: 'mis_update', id: row.id,
        date: date || undefined, package: pkg || undefined,
        manpower_total: manpower,
        activities: activities.filter(a => a.activity),
        reported_by: reporter || undefined,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const verify = async () => {
    setSaving(true);
    try {
      if (row.verified_at) {
        await saveRecord({ type: 'mis_unverify', id: row.id });
      } else {
        await saveRecord({ type: 'mis_verify', id: row.id, verified_by: curatorName || null });
      }
      onVerified();
    } catch { setSaving(false); }
  };

  const detail = typeof row.manpower_detail === 'object' ? row.manpower_detail : {};

  return (
    <>
      <div className={s.mainScroll}>
        <div className={s.recHead}>
          <div>
            <div className={s.recTitle}>{row.project_name}</div>
            <div className={s.recMeta}>Source: {row.source ?? 'form'}</div>
          </div>
          <VerChip row={row} />
        </div>

        <div className={s.fieldGrid}>
          <div className={g.fieldRow}>
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className={g.fieldRow}>
            <label>Package</label>
            <input value={pkg} onChange={e => setPkg(e.target.value)} placeholder="All / General" />
          </div>
          <div className={g.fieldRow}>
            <label>Reporter</label>
            <input value={reporter} onChange={e => setRep(e.target.value)} placeholder="Name…" />
          </div>
        </div>

        {/* Manpower — big total + role breakdown */}
        <div className={s.mpBlock}>
          <div className={s.mpRow}>
            <div>
              <div className={s.mpLabel}>Manpower on site</div>
              <input
                type="number" min="0" value={manpower}
                onChange={e => setMp(+e.target.value || 0)}
                className={s.mpInput}
              />
            </div>
            <ManpowerDetail detail={detail} />
          </div>
        </div>

        {/* Activities — read view + separate edit section */}
        <div className={s.actsSection}>
          <div className={s.actsSectionHead}>
            <span>Activities</span>
            <button type="button" className={cx(s.editActsBtn, editActs && s.editActsBtnOn)}
              onClick={() => setEditActs(v => !v)}>
              {editActs ? 'Done editing' : 'Edit activities'}
            </button>
          </div>
          {!editActs ? (
            <ActivityTable activities={activities} />
          ) : (
            <div className={s.actsEditor}>
              <div className={s.actsColHead}>
                <span>Activity *</span><span>Zone</span><span>Area</span><span />
              </div>
              {activities.map((r, i) => (
                <div key={i} className={s.actsEditorRow}>
                  <SearchSelect items={acts2} value={r.activity} placeholder="Activity *" addLabel="activity"
                    onChange={v => updRow(i, { ...r, activity: v })}
                    onAdd={v => { if (!acts2.includes(v)) setActTypes(a => [...a, v]); }} />
                  <SearchSelect items={zones} value={r.tower} placeholder="Zone (opt)" addLabel="zone"
                    onChange={v => updRow(i, { ...r, tower: v })}
                    onAdd={v => { if (!zones.includes(v)) setZones(z => [...z, v]); }} />
                  <input aria-label="Area" placeholder="Area (opt)" value={r.area}
                    onChange={e => updRow(i, { ...r, area: e.target.value })} />
                  <button type="button" className={g.rmBtn} onClick={() => rmRow(i)} title="Remove">×</button>
                </div>
              ))}
              <button type="button" className={cx(g.addBtn, s.addActBtn)} onClick={addRow}>+ Add activity</button>
            </div>
          )}
        </div>

        {error && <p className={g.formError} style={{ marginTop: 10 }}>{error}</p>}
        {saved  && <p style={{ color: 'var(--go)', fontSize: 13, marginTop: 10, fontWeight: 600 }}>✓ Saved</p>}
      </div>

      <div className={s.actionBar}>
        <button className={s.btnSave} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className={cx(s.btnVerify, row.verified_at && s.btnUnverify)} disabled={saving} onClick={verify}>
          {row.verified_at ? 'Unverify' : '✓ Verify'}
        </button>
        <span className={s.navCounter}>{idx + 1} / {total}</span>
        <button className={s.btnNav} onClick={onPrev} disabled={idx === 0}>← Prev</button>
        <button className={s.btnNav} onClick={onNext} disabled={idx >= total - 1}>Next →</button>
      </div>
    </>
  );
}

// ── Issue detail (always editable) ────────────────────────────────────────────

function IssueDetail({ issue, onVerified, onPrev, onNext, idx, total, curatorName }) {
  const [description, setDesc]  = useState(issue.description ?? '');
  const [owner, setOwner]       = useState(issue.owner ?? '');
  const [ownerType, setOType]   = useState(issue.owner_type ?? 'int');
  const [stage, setStage]       = useState(issue.stage ?? 'raised');
  const [waitingOn, setWait]    = useState(issue.waiting_on ?? '');
  const [note, setNote]         = useState(issue.note ?? '');
  const [resolvedDate, setResD] = useState(issue.resolved_date?.slice(0, 10) ?? '');
  const [raisedDate, setRaisD]  = useState(issue.raised_date?.slice(0, 10) ?? '');
  const [recur, setRecur]       = useState(issue.recur ?? false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    setDesc(issue.description ?? '');
    setOwner(issue.owner ?? '');
    setOType(issue.owner_type ?? 'int');
    setStage(issue.stage ?? 'raised');
    setWait(issue.waiting_on ?? '');
    setNote(issue.note ?? '');
    setResD(issue.resolved_date?.slice(0, 10) ?? '');
    setRaisD(issue.raised_date?.slice(0, 10) ?? '');
    setRecur(issue.recur ?? false);
    setError(''); setSaved(false);
  }, [issue.id]);

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await saveRecord({
        type: 'issue_patch', id: issue.id,
        description: description || undefined,
        owner: owner || undefined, owner_type: ownerType, stage,
        waiting_on: waitingOn || undefined, note: note || undefined,
        resolved_date: resolvedDate || null,
        raised_date: raisedDate || undefined, recur,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const verify = async () => {
    setSaving(true);
    try {
      if (issue.verified_at) {
        await saveRecord({ type: 'issue_unverify', id: issue.id });
      } else {
        await saveRecord({ type: 'issue_verify', id: issue.id, verified_by: curatorName || null });
      }
      onVerified();
    } catch { setSaving(false); }
  };

  return (
    <>
      <div className={s.mainScroll}>
        <div className={s.recHead}>
          <div>
            <div className={s.recTitle}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--blue)', marginRight: 8 }}>{issue.id}</span>
              {issue.project_name}
            </div>
            <div className={s.recMeta}>
              Raised {fmtDate(issue.raised_date)}
              {issue.recur && ' · ↻ Recurring'}
            </div>
          </div>
          <VerChip row={issue} />
        </div>

        {/* Stage — quick tap buttons, most important */}
        <div className={g.fieldRow} style={{ marginBottom: 14 }}>
          <label>Stage</label>
          <QuickBtns options={ISSUE_STAGES} value={stage} onChange={setStage} colorMap={STAGE_COLORS} />
        </div>

        {/* Party type */}
        <div className={g.fieldRow} style={{ marginBottom: 14 }}>
          <label>Party responsible</label>
          <QuickBtns options={ISSUE_OWNER_TYPES} value={ownerType} onChange={setOType} />
        </div>

        <div className={g.fieldRow}>
          <label>Description</label>
          <textarea rows={3} value={description} onChange={e => setDesc(e.target.value)} />
        </div>

        <div className={s.fieldGrid}>
          <div className={g.fieldRow}>
            <label>Owner / responsible name</label>
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Name or team…" />
          </div>
          <div className={g.fieldRow}>
            <label>Waiting on</label>
            <input value={waitingOn} onChange={e => setWait(e.target.value)} placeholder="Who or what is blocking this?" />
          </div>
          <div className={g.fieldRow}>
            <label>Raised date</label>
            <input type="date" value={raisedDate} onChange={e => setRaisD(e.target.value)} />
          </div>
          {stage === 'resolved' && (
            <div className={g.fieldRow}>
              <label>Resolved date</label>
              <input type="date" value={resolvedDate} onChange={e => setResD(e.target.value)} />
            </div>
          )}
        </div>

        <div className={g.fieldRow}>
          <label>Note / context</label>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Latest context, update, or observation…" />
        </div>

        <label className={g.checkRow}>
          <input type="checkbox" checked={recur} onChange={e => setRecur(e.target.checked)} />
          Recurring issue — has happened before
        </label>

        {error && <p className={g.formError} style={{ marginTop: 10 }}>{error}</p>}
        {saved  && <p style={{ color: 'var(--go)', fontSize: 13, marginTop: 10, fontWeight: 600 }}>✓ Saved</p>}
      </div>

      <div className={s.actionBar}>
        <button className={s.btnSave} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className={cx(s.btnVerify, issue.verified_at && s.btnUnverify)} disabled={saving} onClick={verify}>
          {issue.verified_at ? 'Unverify' : '✓ Verify'}
        </button>
        <span className={s.navCounter}>{idx + 1} / {total}</span>
        <button className={s.btnNav} onClick={onPrev} disabled={idx === 0}>← Prev</button>
        <button className={s.btnNav} onClick={onNext} disabled={idx >= total - 1}>Next →</button>
      </div>
    </>
  );
}

function matchesSearch(item, q) {
  if (!q) return true;
  const lq = q.toLowerCase();
  return [
    item.id, item.description, item.owner, item.waiting_on,
    item.note, item.stage, item.project_name, item.package,
    item.reported_by, item.verified_by, item.date, item.raised_date,
  ].some(f => f && String(f).toLowerCase().includes(lq));
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function CuratorsPanel() {
  const [tab, setTab]             = useState('mis');
  const [verFilter, setVerFilter] = useState('unverified');
  const [search, setSearch]       = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [stageFilter, setStageFilter]     = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [misQueue, setMisQueue]   = useState(null);
  const [issQueue, setIssQueue]   = useState(null);
  const [misFull, setMisFull]     = useState(null);
  const [issFull, setIssFull]     = useState(null);
  const [selected, setSelected]   = useState(0);
  const [curatorName, setCurator] = useState(() => sessionStorage.getItem(CURATOR_KEY) ?? '');
  const [projectConfigs, setConfigs] = useState({});

  const reload = useCallback(async () => {
    const [uMis, uIss, allMis, allIss] = await Promise.all([
      fetchUnverifiedMis(),
      fetchUnverifiedIssues(),
      fetchAllMis(),
      fetchAllIssues(),
    ]).catch(() => [null, null, null, null]);
    if (uMis)   setMisQueue(uMis.rows ?? []);
    if (uIss)   setIssQueue(uIss.issues ?? []);
    if (allMis) setMisFull(allMis.rows ?? []);
    if (allIss) setIssFull(allIss.issues ?? []);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!misQueue) return;
    const ids = [...new Set(misQueue.map(r => r.project_id))];
    Promise.all(ids.map(id =>
      fetchProject(id).then(d => [id, d.config ?? null]).catch(() => [id, null])
    )).then(pairs => setConfigs(Object.fromEntries(pairs)));
  }, [misQueue]);

  // Reset list position whenever any filter changes
  useEffect(() => { setSelected(0); }, [search, projectFilter, stageFilter, verFilter, dateFrom, dateTo]);

  const saveCurator = (name) => { setCurator(name); sessionStorage.setItem(CURATOR_KEY, name); };

  // Base list driven by verification filter
  const misBase = verFilter === 'unverified' ? (misQueue ?? [])
    : verFilter === 'verified'   ? (misFull ?? []).filter(r => r.verified_at)
    : (misFull ?? []);

  const issBase = verFilter === 'unverified' ? (issQueue ?? [])
    : verFilter === 'verified'   ? (issFull ?? []).filter(r => r.verified_at)
    : [...(issFull ?? [])].sort((a, b) => {
        if (a.stage === 'resolved' && b.stage !== 'resolved') return 1;
        if (b.stage === 'resolved' && a.stage !== 'resolved') return -1;
        return 0;
      });

  // Apply project / stage / keyword filters client-side
  const misList = misBase
    .filter(r => !projectFilter || r.project_id === projectFilter)
    .filter(r => !dateFrom || r.date >= dateFrom)
    .filter(r => !dateTo   || r.date <= dateTo)
    .filter(r => matchesSearch(r, search));

  const issList = issBase
    .filter(r => !projectFilter || r.project_id === projectFilter)
    .filter(r => !stageFilter   || r.stage === stageFilter)
    .filter(r => matchesSearch(r, search));

  const queue   = tab === 'mis' ? misList : issList;
  const loading = tab === 'mis'
    ? (verFilter === 'unverified' ? misQueue === null : misFull === null)
    : (verFilter === 'unverified' ? issQueue === null : issFull === null);
  const item    = queue[selected] ?? null;

  const advance = (dir) => setSelected(i => Math.max(0, Math.min(queue.length - 1, i + dir)));

  const onVerified = async () => {
    await reload();
    if (verFilter === 'unverified') setSelected(i => Math.min(i, queue.length - 2));
  };

  // Project options from all loaded data (not filtered)
  const projectOptions = [...new Map(
    [...(misFull ?? []), ...(issFull ?? [])]
      .filter(r => r.project_id && r.project_name)
      .map(r => [r.project_id, r.project_name])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const unverMisCount = misQueue?.length ?? 0;
  const unverIssCount = issQueue?.length ?? 0;
  const hasFilters    = !!(search || projectFilter || stageFilter || dateFrom || dateTo);

  return (
    <section className={g.view}>
      <div className={g.wrap}>
        <div style={{ marginBottom: 14 }}>
          <h2 className={g.title} style={{ marginBottom: 2 }}>Curators Panel</h2>
          <p style={{ color: 'var(--steel)', fontSize: 13, margin: 0 }}>
            Review and verify field submissions. Edit directly — every field saves on "Save changes".
          </p>
        </div>

        <div className={s.shell}>
          {/* ── Sidebar ── */}
          <div className={s.sidebar}>
            <div className={s.sidebarHead}>
              {/* Tab switcher */}
              <div className={s.sidebarTabs}>
                <button
                  className={cx(s.sidebarTab, tab === 'mis' && s.sidebarTabOn)}
                  onClick={() => { setTab('mis'); setSelected(0); setStageFilter(''); }}
                >
                  MIS {unverMisCount > 0 && <span style={{ color: 'var(--orange)' }}>({unverMisCount})</span>}
                </button>
                <button
                  className={cx(s.sidebarTab, tab === 'issues' && s.sidebarTabOn)}
                  onClick={() => { setTab('issues'); setSelected(0); }}
                >
                  Issues {unverIssCount > 0 && <span style={{ color: 'var(--orange)' }}>({unverIssCount})</span>}
                </button>
              </div>

              {/* Curator identity */}
              <div className={s.curatorRow}>
                <label>Curating as</label>
                <input value={curatorName} onChange={e => saveCurator(e.target.value)} placeholder="Your name…" />
              </div>

              {/* Filter controls */}
              <div className={s.filterSection}>
                <input
                  className={s.filterInput}
                  placeholder="Search all fields…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select
                  className={s.filterSelect}
                  value={projectFilter}
                  onChange={e => setProjectFilter(e.target.value)}
                >
                  <option value="">All projects</option>
                  {projectOptions.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
                {tab === 'mis' && (
                  <div className={s.dateRow}>
                    <input type="date" className={s.filterInput} value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)} />
                    <input type="date" className={s.filterInput} value={dateTo}
                      onChange={e => setDateTo(e.target.value)} />
                  </div>
                )}
                {tab === 'issues' && (
                  <select
                    className={s.filterSelect}
                    value={stageFilter}
                    onChange={e => setStageFilter(e.target.value)}
                  >
                    <option value="">All stages</option>
                    {ISSUE_STAGES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                )}
                {/* 3-way verification filter */}
                <div className={s.verPills}>
                  {(['unverified', 'all', 'verified']).map(key => (
                    <button
                      key={key}
                      type="button"
                      className={cx(s.verPill, verFilter === key && s.verPillOn)}
                      onClick={() => setVerFilter(key)}
                    >
                      {key === 'unverified'
                        ? `To Verify (${tab === 'mis' ? unverMisCount : unverIssCount})`
                        : key === 'all' ? 'All' : 'Verified'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className={s.sidebarEmpty} style={{ color: 'var(--steel)' }}>Loading…</div>
            ) : queue.length === 0 ? (
              <div className={s.sidebarEmpty}>
                {verFilter === 'unverified' && !hasFilters
                  ? <><strong>All clear!</strong>No unverified records.</>
                  : <><strong>No results.</strong>{hasFilters ? ' Try clearing filters.' : ''}</>}
              </div>
            ) : (
              <>
                <div className={s.sidebarStat}>
                  <span>{queue.length} {verFilter === 'all' ? 'total' : verFilter}</span>
                  {hasFilters && <span style={{ color: 'var(--blue2)', fontWeight: 600 }}>· filtered</span>}
                </div>
                <div className={s.queueList}>
                  {queue.map((it, i) => (
                    <div
                      key={it.id}
                      className={cx(s.queueItem, i === selected && s.queueItemOn)}
                      style={{ boxShadow: `inset 3px 0 0 ${statusColor(it)}` }}
                      onClick={() => setSelected(i)}
                    >
                      <div className={s.queueItemDate}>
                        {tab === 'mis'
                          ? fmtDate(it.date)
                          : <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{it.id}</span>}
                      </div>
                      <div className={s.queueItemMeta}>
                        {tab === 'mis'
                          ? `${it.project_name} · ${it.manpower_total} crew`
                          : it.description?.slice(0, 50)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Main panel ── */}
          <div className={s.main}>
            {!item ? (
              <div className={s.emptyMain}>
                {queue.length === 0
                  ? (verFilter === 'unverified' && !hasFilters
                      ? 'Nothing to verify — queue is empty.'
                      : 'No records match the current filters.')
                  : 'Select a record from the list to review it.'}
              </div>
            ) : tab === 'mis' ? (
              <MisDetail
                key={item.id}
                row={item}
                projectConfig={projectConfigs[item.project_id]}
                curatorName={curatorName}
                idx={selected} total={queue.length}
                onVerified={onVerified}
                onPrev={() => advance(-1)}
                onNext={() => advance(1)}
              />
            ) : (
              <IssueDetail
                key={item.id}
                issue={item}
                curatorName={curatorName}
                idx={selected} total={queue.length}
                onVerified={onVerified}
                onPrev={() => advance(-1)}
                onNext={() => advance(1)}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
