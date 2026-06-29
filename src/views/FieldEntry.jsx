import { useState, useEffect } from 'react';
import { fetchPortfolio, fetchProject, saveRecord } from '../api/client.js';
import { TOAST_MS, REPORTER_STAGES, ISSUE_OWNER_TYPES, MANPOWER_ROLES } from '../lib/constants.js';
import Eyebrow from '../components/Eyebrow.jsx';
import SearchSelect from '../components/SearchSelect.jsx';
import g from '../styles/shared.module.css';
import s from './FieldEntry.module.css';
import { cx } from '../lib/cx.js';

// ── WhatsApp message builders ──────────────────────────────────────────────────

function buildMisMessage({ projectName, date, pkg, reporterName, manpowerTotal, roles, activities }) {
  const d = date ? new Date(date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const roleLine = Object.entries(roles).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(' | ');
  const actLines = activities.filter(a => a.activity).map(a => `- ${[a.tower, a.area, a.activity].filter(Boolean).join(' / ')}`).join('\n');
  return [
    '*ABJA Power — Daily MIS*',
    `Project: ${projectName || '—'}`,
    `Date: ${d}`,
    pkg && `Package: ${pkg}`,
    `Reporter: ${reporterName || '—'}`,
    '',
    `*Manpower: ${manpowerTotal}*`,
    roleLine || null,
    actLines ? `\n*Activities:*\n${actLines}` : null,
  ].filter(l => l != null).join('\n');
}

function buildBlockerMessage({ projectName, date, mode, description, ownerType, ownerName, neededBy, issueId, note }) {
  const d = date ? new Date(date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const prefix = mode === 'new' ? '[NEW]' : mode === 'close' ? '[CLOSED]' : '[UPDATE]';
  const typeLabel = { int: 'Internal', ext: 'External', com: 'Compliance' }[ownerType] ?? ownerType;
  return [
    '*ABJA Power — Blocker Report*',
    `Project: ${projectName || '—'}`,
    `Date: ${d}`,
    '',
    `*${prefix}${issueId ? ' ' + issueId : ''} ${description || ''}*`.trim(),
    ownerType && `Type: ${typeLabel} | Owner: ${ownerName || '—'}`,
    neededBy && `Needed by: ${neededBy}`,
    note && `Note: ${note}`,
  ].filter(Boolean).join('\n');
}

// ── Shared small components ────────────────────────────────────────────────────

function Stepper({ label, value, onChange }) {
  return (
    <div className={s.stepper}>
      <span className={s.stepLabel}>{label}</span>
      <div className={s.stepCtrl}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <input
          type="number" min="0" value={value}
          onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        />
        <button type="button" onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function zoneLabel(z) { return typeof z === 'string' ? z : z?.name ?? String(z); }

function ActivityRow({ row, zones, activityTypes, onChange, onRemove, onAddActivity, onAddZone }) {
  return (
    <div
      className={g.actRow}
      style={{
        borderLeft: row.activity ? '2px solid var(--blue2)' : '2px solid var(--line)',
        paddingLeft: 8, marginLeft: -8,
      }}
    >
      {/* Activity first — it's required; zone + area are optional */}
      <SearchSelect
        items={activityTypes}
        value={row.activity}
        onChange={v => onChange({ ...row, activity: v })}
        onAdd={onAddActivity}
        placeholder="Activity *"
        addLabel="activity"
      />
      <SearchSelect
        items={zones.map(zoneLabel)}
        value={row.tower}
        onChange={v => onChange({ ...row, tower: v })}
        onAdd={onAddZone}
        placeholder="Zone (opt)"
        addLabel="zone"
      />
      <input
        aria-label="Area"
        placeholder="Area (opt)"
        value={row.area}
        onChange={e => onChange({ ...row, area: e.target.value })}
        style={{ flex: '0 0 100px', minWidth: 0 }}
      />
      <button type="button" className={g.rmBtn} onClick={onRemove} title="Remove row">×</button>
    </div>
  );
}

function WaPreview({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); });
  };
  return (
    <div className={s.waPreview}>
      <div className={s.waHeader}>
        <span>WhatsApp message</span>
        <button type="button" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

// ── MIS form ───────────────────────────────────────────────────────────────────

const DEFAULT_ROLES = MANPOWER_ROLES;

function MisForm({ projectId, projectName, config, liveZones, liveActivities, onAddZone, onAddActivity, date, reporterName, onSaved }) {
  const workPackages = config?.work_packages ?? [];

  const [pkg, setPkg]                     = useState('');
  const [manpowerTotal, setManpowerTotal] = useState(0);
  const [roles, setRoles]                 = useState(() => Object.fromEntries(DEFAULT_ROLES.map(r => [r, 0])));
  const [activities, setActivities]       = useState([{ tower: '', area: '', activity: '' }]);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');

  const roleTotal      = Object.values(roles).reduce((a, b) => a + b, 0);
  const effectiveTotal = manpowerTotal || roleTotal;
  const message        = buildMisMessage({ projectName, date, pkg, reporterName, manpowerTotal: effectiveTotal, roles, activities });

  const addRow    = () => setActivities(a => [...a, { tower: '', area: '', activity: '' }]);
  const updateRow = (i, val) => setActivities(a => a.map((r, j) => j === i ? val : r));
  const removeRow = (i) => setActivities(a => a.filter((_, j) => j !== i));
  const setRole   = (role, v) => setRoles(r => ({ ...r, [role]: v }));

  const save = async () => {
    if (!date) return setError('Date is required');
    if (!effectiveTotal) return setError('Add manpower count');
    setError(''); setSaving(true);
    try {
      await saveRecord({
        type: 'mis_row',
        project_id: projectId,
        date,
        package: pkg || null,
        manpower_total: effectiveTotal,
        manpower_detail: roles,
        activities: activities.filter(a => a.activity),
        reported_by: reporterName || null,
        source: 'form',
      });
      onSaved('MIS entry saved');
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={g.entrySection}>
      <Eyebrow>Manpower & Activities</Eyebrow>

      <div className={g.fieldRow}>
        <label>Package</label>
        <SearchSelect items={workPackages} value={pkg} onChange={setPkg} placeholder="All / General" />
      </div>

      <Stepper label="Total manpower on site" value={manpowerTotal} onChange={setManpowerTotal} />

      <details className={s.rolesSection}>
        <summary>Role breakdown <span className={g.hint}>(optional)</span></summary>
        <div className={s.rolesGrid}>
          {Object.keys(roles).map(role => (
            <Stepper key={role} label={role} value={roles[role]} onChange={v => setRole(role, v)} />
          ))}
        </div>
        {roleTotal > 0 && (
          <p style={{ color: 'var(--go)', fontWeight: 600, fontSize: 13 }}>Role sum: {roleTotal}</p>
        )}
        {roleTotal > 0 && roleTotal !== manpowerTotal && manpowerTotal > 0 && (
          <p className={g.hintNote}>Role sum = {roleTotal}. Total above overrides.</p>
        )}
      </details>

      <div className={g.actsHeader}>
        <span>Activities</span>
        <button type="button" className={g.addBtn} onClick={addRow}>+ Add row</button>
      </div>
      {activities.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '0 0 4px 8px', marginLeft: -8 }}>
          <span style={{ flex: 1, fontSize: 10, color: 'var(--steel)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Activity *</span>
          <span style={{ flex: 1, fontSize: 10, color: 'var(--steel)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Zone</span>
          <span style={{ flex: '0 0 100px', fontSize: 10, color: 'var(--steel)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Area</span>
          <span style={{ width: 28 }} />
        </div>
      )}

      {activities.map((row, i) => (
        <ActivityRow
          key={i} row={row}
          zones={liveZones}
          activityTypes={liveActivities}
          onChange={v => updateRow(i, v)}
          onRemove={() => removeRow(i)}
          onAddActivity={onAddActivity}
          onAddZone={onAddZone}
        />
      ))}

      <WaPreview text={message} />

      {error && <p className={g.formError}>⚠ {error}</p>}
      <button className={g.saveBtn} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save to database'}
      </button>
    </div>
  );
}

// ── Blocker form ───────────────────────────────────────────────────────────────

// REPORTER_STAGES and ISSUE_OWNER_TYPES come from constants — no local definitions.
const OWNER_TYPE_BADGE = { int: g.badgeInt, ext: g.badgeExt, com: g.badgeCom };
const OWNER_TYPE_LABEL = Object.fromEntries(ISSUE_OWNER_TYPES.map(o => [o.value, o.label]));

function BlockerForm({ projectId, projectName, openIssues, date, reporterName, onSaved }) {
  const [mode, setMode]                 = useState('new');
  const [selectedId, setSelectedId]     = useState('');
  const [description, setDescription]   = useState('');
  const [ownerType, setOwnerType]       = useState('int');
  const [ownerName, setOwnerName]       = useState('');
  const [neededBy, setNeededBy]         = useState('');
  const [waitingOn, setWaitingOn]       = useState('');
  const [note, setNote]                 = useState('');
  const [stage, setStage]               = useState('raised');
  const [recur, setRecur]               = useState(false);
  const [photoInGroup, setPhotoInGroup] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const selected    = openIssues.find(i => i.id === selectedId);
  const displayDesc = mode === 'new' ? description : selected?.description ?? '';

  const message = buildBlockerMessage({
    projectName, date, mode,
    description: displayDesc,
    ownerType: mode === 'new' ? ownerType : selected?.owner_type,
    ownerName: mode === 'new' ? ownerName : selected?.owner,
    neededBy, issueId: selectedId, note,
  });

  const changeMode = (m) => { setMode(m); setSelectedId(''); setError(''); };

  const save = async () => {
    if (!date) return setError('Date is required');
    setError(''); setSaving(true);
    try {
      if (mode === 'new') {
        if (!description.trim()) { setSaving(false); return setError('Description required'); }
        await saveRecord({
          type: 'issue_new',
          project_id: projectId,
          description: description.trim(),
          owner: ownerName || null,
          owner_type: ownerType,
          stage: 'raised',
          waiting_on: waitingOn || null,
          needed_by: neededBy || null,
          photo_in_group: photoInGroup,
          raised_date: date,
          raw_text: message,
          reported_by: reporterName || null,
          source: 'form',
        });
        setDescription(''); setOwnerName(''); setNeededBy(''); setWaitingOn('');
      } else {
        if (!selectedId) { setSaving(false); return setError('Select an issue'); }
        await saveRecord({
          type: 'issue_update',
          id: selectedId,
          stage: mode === 'close' ? 'resolved' : stage,
          resolved_date: mode === 'close' ? date : null,
          recur: mode === 'update' ? recur : undefined,
          waiting_on: mode === 'update' ? (waitingOn || null) : undefined,
          note: note || null,
          raw_text: message,
          photo_in_group: photoInGroup,
          reported_by: reporterName || null,
          date,
          source: 'form',
        });
        setSelectedId(''); setRecur(false); setWaitingOn('');
      }
      setNote(''); setPhotoInGroup(false);
      onSaved('Blocker saved');
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={g.entrySection}>
      <Eyebrow>Blocker / Issue</Eyebrow>

      <div className={s.modeTabs}>
        {[['new', 'New Issue'], ['update', 'Update Issue'], ['close', 'Mark Resolved']].map(([m, label]) => (
          <button key={m} type="button" className={cx(g.pill, mode === m && g.on)} onClick={() => changeMode(m)}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'new' ? (
        <>
          {openIssues.length > 0 && (
            <div className={s.openIssuesHint}>
              <div className={g.caption} style={{ marginBottom: 6 }}>Open issues — check before raising new</div>
              {openIssues.map(i => (
                <div key={i.id} className={s.hintIssueRow}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--blue)' }}>{i.id}</span>
                  <span style={{ fontSize: 12, marginLeft: 8 }}>{String(i.description ?? '').slice(0, 60)}</span>
                  <span style={{ fontSize: 11, color: 'var(--steel)', marginLeft: 6 }}>{i.age_days}d</span>
                </div>
              ))}
            </div>
          )}
          <div className={g.fieldRow}>
            <label>What is the blocker?</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the blocker…" />
          </div>
          <div className={cx(g.fieldRow, g.twoCol)}>
            <div>
              <label>Who owns this?</label>
              <select value={ownerType} onChange={e => setOwnerType(e.target.value)}>
                {ISSUE_OWNER_TYPES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Owner name / team</label>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Name or team…" />
            </div>
          </div>
          <div className={g.fieldRow}>
            <label>Target resolution date</label>
            <input type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)} />
          </div>
          <div className={g.fieldRow}>
            <label>Waiting on <span style={{ color: 'var(--steel)', fontWeight: 400 }}>(optional)</span></label>
            <input value={waitingOn} onChange={e => setWaitingOn(e.target.value)} placeholder="Who or what is blocking this?" />
          </div>
        </>
      ) : (
        <>
          <div className={g.fieldRow}>
            <label>{mode === 'close' ? 'Issue being resolved' : 'Select issue'} *</label>
            <SearchSelect
              items={openIssues.map(i => `${i.id} — ${String(i.description ?? '').slice(0, 60)}`)}
              value={selectedId ? `${selectedId} — ${String(openIssues.find(i => i.id === selectedId)?.description ?? '').slice(0, 60)}` : ''}
              onChange={(val) => {
                const id = val.split(' — ')[0];
                setSelectedId(id);
                const issue = openIssues.find(i => i.id === id);
                setRecur(issue?.recur ?? false);
              }}
              placeholder="Select open issue…"
            />
          </div>
          {selected && (
            <div className={s.issueContext}>
              <span className={cx(g.badge, OWNER_TYPE_BADGE[selected.owner_type])}>
                {OWNER_TYPE_LABEL[selected.owner_type] ?? selected.owner_type}
              </span>
              <span>{selected.owner}</span>
              <span className={g.hint}> · {selected.age_days}d old</span>
            </div>
          )}
          {mode === 'update' && (
            <>
              <div className={g.fieldRow}>
                <label>New stage</label>
                <select value={stage} onChange={e => setStage(e.target.value)}>
                  {REPORTER_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <label className={g.checkRow}>
                <input type="checkbox" checked={recur} onChange={e => setRecur(e.target.checked)} />
                This issue has recurred
              </label>
              <div className={g.fieldRow} style={{ marginTop: 10 }}>
                <label>Waiting on <span style={{ color: 'var(--steel)', fontWeight: 400 }}>(optional)</span></label>
                <input value={waitingOn} onChange={e => setWaitingOn(e.target.value)} placeholder="Who or what is blocking this?" />
              </div>
            </>
          )}
        </>
      )}

      <div className={g.fieldRow}>
        <label>Context / update</label>
        <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Context or update…" />
      </div>
      <label className={g.checkRow}>
        <input type="checkbox" checked={photoInGroup} onChange={e => setPhotoInGroup(e.target.checked)} />
        Photo shared in group
      </label>

      <WaPreview text={message} />

      {error && <p className={g.formError}>⚠ {error}</p>}
      <button className={g.saveBtn} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save to database'}
      </button>
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function FieldEntry() {
  const [projects, setProjects]             = useState([]);
  const [projectId, setProjectId]           = useState('');
  const [config, setConfig]                 = useState(null);
  const [liveZones, setLiveZones]           = useState([]);
  const [liveActivities, setLiveActivities] = useState([]);
  const [openIssues, setOpenIssues]         = useState([]);
  const [date, setDate]                     = useState(new Date().toISOString().slice(0, 10));
  const [reporterName, setReporter]         = useState('');
  const [tab, setTab]                       = useState('mis');
  const [toast, setToast]                   = useState('');

  useEffect(() => {
    fetchPortfolio().then(d => setProjects(d.projects ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) { setConfig(null); setLiveZones([]); setLiveActivities([]); setOpenIssues([]); return; }
    fetchProject(projectId).then(d => {
      setConfig(d.config ?? null);
      setLiveZones(d.config?.towers ?? []);
      setLiveActivities(d.config?.activity_types ?? []);
      setOpenIssues(d.openIssues ?? []);
    }).catch(() => {});
  }, [projectId]);

  const project = projects.find(p => p.id === projectId);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), TOAST_MS); };

  const handleAddZone = async (zone) => {
    if (liveZones.includes(zone)) return;
    setLiveZones(prev => [...prev, zone]);
    try {
      await saveRecord({ type: 'project_add_zone', project_id: projectId, zone });
    } catch {
      setLiveZones(prev => prev.filter(z => z !== zone));
    }
  };

  const handleAddActivity = async (activity) => {
    if (liveActivities.includes(activity)) return;
    setLiveActivities(prev => [...prev, activity]);
    try {
      await saveRecord({ type: 'project_add_activity', project_id: projectId, activity });
    } catch {
      setLiveActivities(prev => prev.filter(a => a !== activity));
    }
  };

  return (
    <section className={g.view}>
      <div className={g.wrap} style={{ maxWidth: 700 }}>
        <h2 className={g.title}>Daily Field Report</h2>
        <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 24 }}>
          Submit daily crew count, activities, and issue updates for your project.
        </p>

        <div className={g.card} style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--steel)', marginBottom: 8 }}>Report Details</p>
          <div className={g.fieldRow}>
            <label>Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className={cx(g.fieldRow, g.twoCol)}>
            <div>
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label>Your name</label>
              <input value={reporterName} onChange={e => setReporter(e.target.value)} placeholder="Reporter name…" />
            </div>
          </div>
        </div>

        {!projectId && (
          <div className={g.loading}>Select a project to begin entry.</div>
        )}

        {projectId && (
          <>
            <div className={g.subtabs}>
              <button className={cx(g.pill, tab === 'mis' && g.on, tab === 'mis' && g.ov)} onClick={() => setTab('mis')}>
                MIS — Manpower
              </button>
              <button className={cx(g.pill, tab === 'blocker' && g.on)} onClick={() => setTab('blocker')}>
                Blockers
              </button>
            </div>

            <div className={g.card}>
              {tab === 'mis' && (
                <MisForm
                  projectId={projectId} projectName={project?.name}
                  config={config}
                  liveZones={liveZones}
                  liveActivities={liveActivities}
                  onAddZone={handleAddZone}
                  onAddActivity={handleAddActivity}
                  date={date} reporterName={reporterName}
                  onSaved={showToast}
                />
              )}
              {tab === 'blocker' && (
                <BlockerForm
                  projectId={projectId} projectName={project?.name}
                  openIssues={openIssues}
                  date={date} reporterName={reporterName}
                  onSaved={showToast}
                />
              )}
            </div>
          </>
        )}

        {toast && <div className={s.toast}>{toast}</div>}
      </div>
    </section>
  );
}
