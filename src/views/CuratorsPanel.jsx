import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllMis, fetchAllIssues,
  fetchUnverifiedMis, fetchUnverifiedIssues,
  fetchProject, fetchSightings, saveRecord,
} from '../api/client.js';
import { fmtDate } from '../lib/format.js';
import { ISSUE_STAGES, ISSUE_OWNER_TYPES, STAGE_COLORS, PRIORITY_LEVELS } from '../lib/constants.js';
import { useAuth } from '../lib/AuthContext.jsx';
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

function HrDetail({ detail }) {
  if (!detail || typeof detail !== 'object') return null;
  const entries = Object.entries(detail).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return null;
  return (
    <div className={s.hrDetail}>
      {entries.map(([role, count]) => (
        <span key={role} className={s.hrChip}>
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

function MisDetail({ row, projectConfig, onVerified, onPrev, onNext, idx, total }) {
  const [date, setDate]       = useState(row.date?.slice(0, 10) ?? '');
  const [pkg, setPkg]         = useState(row.package ?? '');
  const [reporter, setRep]    = useState(row.reported_by ?? '');
  const [roles, setRoles]     = useState(
    typeof row.hr_detail === 'object' && row.hr_detail
      ? { ...row.hr_detail }
      : {}
  );
  const [activities, setActs] = useState(
    (Array.isArray(row.activities) ? row.activities : []).map(a => ({
      activity: a.activity ?? '', tower: a.tower ?? '', area: a.area ?? '',
    }))
  );
  const [editActs, setEditActs] = useState(false);
  const [zones, setZones]       = useState(projectConfig?.towers ?? []);
  const [acts2, setActTypes]    = useState(projectConfig?.activity_types ?? []);

  useEffect(() => {
    if (projectConfig?.towers?.length)         setZones(projectConfig.towers);
    if (projectConfig?.activity_types?.length) setActTypes(projectConfig.activity_types);
  }, [projectConfig]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    setDate(row.date?.slice(0, 10) ?? '');
    setPkg(row.package ?? '');
    setRep(row.reported_by ?? '');
    setRoles(
      typeof row.hr_detail === 'object' && row.hr_detail
        ? { ...row.hr_detail }
        : {}
    );
    setActs((Array.isArray(row.activities) ? row.activities : []).map(a => ({
      activity: a.activity ?? '', tower: a.tower ?? '', area: a.area ?? '',
    })));
    setEditActs(false); setError(''); setSaved(false);
  }, [row.id]);

  const setRole    = (role, v) => setRoles(r => ({ ...r, [role]: Math.max(0, v) }));
  const removeRole = (role) => setRoles(r => { const n = { ...r }; delete n[role]; return n; });
  // One-off addition for this entry only — does not touch the project's master role list.
  const addRole    = (name) => {
    if (!name || roles[name] !== undefined) return;
    setRoles(r => ({ ...r, [name]: 0 }));
  };
  const hrTotal = Object.values(roles).reduce((a, b) => a + Number(b), 0);

  const addRow = () => setActs(a => [...a, { activity: '', tower: '', area: '' }]);
  const updRow = (i, v) => setActs(a => a.map((r, j) => j === i ? v : r));
  const rmRow  = (i) => setActs(a => a.filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await saveRecord({
        type: 'mis_update', id: row.id,
        date: date || undefined, package: pkg || undefined,
        hr_detail: roles,
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
        await saveRecord({ type: 'mis_verify', id: row.id });
      }
      onVerified();
    } catch { setSaving(false); }
  };

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

        {/* Human Resource — auto-summed total (sum of roles below) + editable role breakdown */}
        <div className={s.hrBlock}>
          <div className={s.hrLabel}>Human Resource on site</div>
          <div className={s.hrTotal}>{hrTotal}</div>
          {Object.keys(roles).length > 0 && (
            <div className={s.rolesGrid}>
              {Object.entries(roles).map(([role, count]) => (
                <div key={role} className={s.roleStepper}>
                  <span className={s.roleLabel}>{role}</span>
                  <div className={s.stepCtrl}>
                    <button type="button" onClick={() => setRole(role, count - 1)}>−</button>
                    <input
                      type="number" min="0" value={count}
                      onChange={e => setRole(role, parseInt(e.target.value) || 0)}
                    />
                    <button type="button" onClick={() => setRole(role, count + 1)}>+</button>
                  </div>
                  <button type="button" className={s.roleRemoveBtn} onClick={() => removeRole(role)} title="Remove">×</button>
                </div>
              ))}
            </div>
          )}
          <div className={s.addRoleRow}>
            <SearchSelect
              items={(projectConfig?.hr_roles ?? []).filter(r => roles[r] === undefined)}
              value=""
              placeholder="Add role… (one-off for this entry only)"
              addLabel="role"
              onChange={addRole}
              onAdd={addRole}
            />
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
                    onAdd={v => {
                      if (acts2.includes(v)) return;
                      setActTypes(a => [...a, v]);
                      saveRecord({ type: 'project_add_activity', project_id: row.project_id, activity: v }).catch(() => {});
                    }} />
                  <SearchSelect items={zones} value={r.tower} placeholder="Zone (opt)" addLabel="zone"
                    onChange={v => updRow(i, { ...r, tower: v })}
                    onAdd={v => {
                      if (zones.includes(v)) return;
                      setZones(z => [...z, v]);
                      saveRecord({ type: 'project_add_zone', project_id: row.project_id, zone: v }).catch(() => {});
                    }} />
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

function IssueDetail({ issue, contacts, onVerified, onPrev, onNext, idx, total, curatorName }) {
  const [description, setDesc]  = useState(issue.description ?? '');
  const [owner, setOwner]       = useState(issue.owner ?? '');
  const [ownerType, setOType]   = useState(issue.owner_type ?? 'int');
  const [stage, setStage]       = useState(issue.stage ?? 'raised');
  const [waitingOn, setWait]    = useState(issue.waiting_on ?? '');
  const [note, setNote]         = useState(issue.note ?? '');
  const [resolvedDate, setResD] = useState(issue.resolved_date?.slice(0, 10) ?? '');
  const [raisedDate, setRaisD]  = useState(issue.raised_date?.slice(0, 10) ?? '');
  const [recur, setRecur]       = useState(issue.recur ?? false);
  const [priority, setPriority] = useState(issue.priority ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState(false);
  const [sightings, setSightings] = useState([]);

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
    setPriority(issue.priority ?? '');
    setError(''); setSaved(false);
    setSightings([]);
    fetchSightings(issue.id).then(d => setSightings(d.sightings ?? [])).catch(() => {});
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
        priority: priority || null,
        reported_by: curatorName || undefined,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      fetchSightings(issue.id).then(d => setSightings(d.sightings ?? [])).catch(() => {});
    } catch (e) { setError(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const verify = async () => {
    setSaving(true);
    try {
      if (issue.verified_at) {
        await saveRecord({ type: 'issue_unverify', id: issue.id });
      } else {
        await saveRecord({ type: 'issue_verify', id: issue.id });
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {priority && (() => {
              const p = PRIORITY_LEVELS.find(l => l.value === priority);
              return p ? <span className={s.priorityBadge} style={{ background: p.color }}>{p.label}</span> : null;
            })()}
            <VerChip row={issue} />
          </div>
        </div>

        {/* Priority */}
        <div className={g.fieldRow} style={{ marginBottom: 14 }}>
          <label>Priority <span style={{ color: 'var(--steel)', fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRIORITY_LEVELS.map(p => (
              <button
                key={p.value}
                type="button"
                className={cx(s.quickBtn, priority === p.value && s.quickBtnOn)}
                style={priority === p.value ? { background: p.color, borderColor: p.color } : {}}
                onClick={() => setPriority(v => v === p.value ? '' : p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stage — quick tap buttons, most important */}
        <div className={g.fieldRow} style={{ marginBottom: 14 }}>
          <label>Stage</label>
          <QuickBtns
            options={ISSUE_STAGES}
            value={stage}
            onChange={v => {
              setStage(v);
              if (v === 'resolved' && !resolvedDate) setResD(new Date().toISOString().slice(0, 10));
            }}
            colorMap={STAGE_COLORS}
          />
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
            <SearchSelect
              items={(contacts ?? [])
                .map(c => ({ label: c.contact_person || c.entity, tag: c.category || undefined }))
                .filter(c => c.label)}
              value={owner}
              onChange={setOwner}
              placeholder="Select owner…"
            />
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

        {sightings.length > 0 && (
          <div className={s.timeline}>
            <div className={s.timelineHead}>Activity log</div>
            {sightings.map((sg, i) => {
              const isCreated = i === sightings.length - 1;
              const isResolved = sg.implied_status === 'Actioned';
              const label   = isCreated ? 'Created' : isResolved ? 'Resolved' : 'Updated';
              const dotCls  = isCreated ? s.dotCreated : isResolved ? s.dotResolved : s.dotUpdated;
              return (
                <div key={sg.id ?? i} className={s.timelineRow}>
                  <div className={s.timelineLine}>
                    <span className={cx(s.dot, dotCls)} />
                    {i < sightings.length - 1 && <span className={s.connector} />}
                  </div>
                  <div className={s.timelineContent}>
                    <div className={s.timelineTop}>
                      <span className={cx(s.timelineLabel, dotCls)}>{label}</span>
                      <span className={s.timelineDate}>{fmtDate(sg.date)}</span>
                      {sg.reported_by && <span className={s.timelineBy}>{sg.reported_by}</span>}
                      {sg.photo_in_group && <span className={s.timelinePhoto}>📷</span>}
                    </div>
                    {sg.raw_text && !['Raised', 'Updated', 'Resolved'].includes(sg.raw_text) && (
                      <div className={s.timelineNote}>{sg.raw_text}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
  const { user } = useAuth();
  // Pre-filled from login, left editable — same reasoning as Field Entry's
  // reporter name: a shared device or a correction shouldn't be blocked.
  const [curatorName, setCurator] = useState(() => user.name || user.email);

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
  const [projectConfigs, setConfigs]   = useState({});
  const [projectContacts, setPContacts] = useState({});

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
    const allRows = [...(misQueue ?? []), ...(misFull ?? []), ...(issQueue ?? []), ...(issFull ?? [])];
    if (!allRows.length) return;
    const ids = [...new Set(allRows.map(r => r.project_id).filter(Boolean))];
    Promise.all(ids.map(id =>
      fetchProject(id).then(d => [id, d]).catch(() => [id, null])
    )).then(pairs => {
      setConfigs(Object.fromEntries(pairs.map(([id, d]) => [id, d?.config ?? null])));
      setPContacts(Object.fromEntries(pairs.map(([id, d]) => [id, d?.contacts ?? []])));
    });
  }, [misQueue, misFull, issQueue, issFull]);

  // Reset list position whenever any filter changes
  useEffect(() => { setSelected(0); }, [search, projectFilter, stageFilter, verFilter, dateFrom, dateTo]);

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

              {/* Curator identity — pre-filled from login, editable */}
              <div className={s.curatorRow}>
                <label>Curating as</label>
                <input value={curatorName} onChange={e => setCurator(e.target.value)} placeholder="Your name…" />
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
                          ? `${it.project_name} · ${it.hr_total} crew`
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
                idx={selected} total={queue.length}
                onVerified={onVerified}
                onPrev={() => advance(-1)}
                onNext={() => advance(1)}
              />
            ) : (
              <IssueDetail
                key={item.id}
                issue={item}
                contacts={projectContacts[item.project_id] ?? []}
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
