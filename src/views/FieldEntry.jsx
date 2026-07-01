import { useState, useEffect } from 'react';
import { fetchPortfolio, fetchProject, saveRecord } from '../api/client.js';
import { TOAST_MS, REPORTER_STAGES, ISSUE_OWNER_TYPES, STAGE_COLORS, PRIORITY_LEVELS } from '../lib/constants.js';
import { useAuth } from '../lib/AuthContext.jsx';
import Eyebrow from '../components/Eyebrow.jsx';
import SearchSelect from '../components/SearchSelect.jsx';
import g from '../styles/shared.module.css';
import s from './FieldEntry.module.css';
import { cx } from '../lib/cx.js';

// ── WhatsApp message builders ──────────────────────────────────────────────────

function buildMisMessage({ projectName, date, pkg, reporterName, hrTotal, roles, activities }) {
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
    `*Human Resource: ${hrTotal}*`,
    roleLine || null,
    actLines ? `\n*Activities:*\n${actLines}` : null,
  ].filter(l => l != null).join('\n');
}

function buildBlockerMessage({ projectName, date, mode, stage, description, ownerType, ownerName, neededBy, issueId, note }) {
  const d = date ? new Date(date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const prefix = mode === 'new' ? '[NEW]' : stage === 'resolved' ? '[RESOLVED]' : '[UPDATE]';
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

function ActivityRow({ row, zones, activityTypes, onChange, onRemove, onAddActivity }) {
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
      {/* Zone is search-only — no "add new" here, the project's zone list is admin-managed */}
      <SearchSelect
        items={zones.map(zoneLabel)}
        value={row.tower}
        onChange={v => onChange({ ...row, tower: v })}
        placeholder="Zone (opt)"
      />
      <input
        aria-label="Area"
        placeholder="Area (opt)"
        value={row.area}
        onChange={e => onChange({ ...row, area: e.target.value })}
      />
      <button type="button" className={g.rmBtn} onClick={onRemove} title="Remove row">×</button>
    </div>
  );
}

function WaPreview({ text }) {
  return (
    <div className={s.waPreview}>
      <div className={s.waHeader}>
        <span>WhatsApp message</span>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

// One button, two states — a lone "Copy" button let people copy the message, think
// they were done, and never actually save it. Before the first successful save this
// button submits then copies. After that, it becomes copy-only — it can never
// resubmit and re-copies the exact text that was actually saved (frozen at submit
// time), even if the form is edited afterward. Only a page reload resets it.
function SubmitCopyBar({ text, saving, error, onSubmit }) {
  const [copied, setCopied]               = useState(false);
  const [submittedText, setSubmittedText] = useState(null);

  const copy = (value) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleClick = async () => {
    if (submittedText != null) { copy(submittedText); return; }
    const ok = await onSubmit();
    if (ok) { setSubmittedText(text); copy(text); }
  };

  const label = saving ? 'Saving…' : submittedText != null ? (copied ? 'Copied!' : 'Copy again') : 'Submit & Copy';

  return (
    <>
      {error && <p className={g.formError}>⚠ {error}</p>}
      <button className={g.saveBtn} onClick={handleClick} disabled={saving}>
        {label}
      </button>
    </>
  );
}

// ── MIS form ───────────────────────────────────────────────────────────────────

function MisForm({ projectId, projectName, config, liveZones, liveActivities, onAddActivity, date, reporterName, onSaved }) {
  const workPackages = config?.work_packages ?? [];
  const hrRoleNames   = config?.hr_roles ?? [];

  const [pkg, setPkg]               = useState('');
  const [roles, setRoles]           = useState({});
  const [activities, setActivities] = useState([{ tower: '', area: '', activity: '' }]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Project config arrives async after project selection — (re)seed the role
  // steppers from that project's own list once it lands.
  useEffect(() => {
    setRoles(Object.fromEntries(hrRoleNames.map(r => [r, 0])));
  }, [config]);

  const hrTotal  = Object.values(roles).reduce((a, b) => a + b, 0);
  const message  = buildMisMessage({ projectName, date, pkg, reporterName, hrTotal, roles, activities });

  const addRow    = () => setActivities(a => [...a, { tower: '', area: '', activity: '' }]);
  const updateRow = (i, val) => setActivities(a => a.map((r, j) => j === i ? val : r));
  const removeRow = (i) => setActivities(a => a.filter((_, j) => j !== i));
  const setRole   = (role, v) => setRoles(r => ({ ...r, [role]: v }));

  const save = async () => {
    if (!date) { setError('Date is required'); return false; }
    setError(''); setSaving(true);
    try {
      await saveRecord({
        type: 'mis_row',
        project_id: projectId,
        date,
        package: pkg || null,
        hr_detail: roles,
        activities: activities.filter(a => a.activity),
        reported_by: reporterName || null,
        source: 'form',
      });
      onSaved('MIS entry saved');
      return true;
    } catch (e) {
      setError(e.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={g.entrySection}>
      <Eyebrow>Human Resource & Activities</Eyebrow>

      <div className={g.fieldRow}>
        <label>Package</label>
        <SearchSelect items={workPackages} value={pkg} onChange={setPkg} placeholder="All / General" />
      </div>

      <div className={s.hrBlock}>
        <div className={s.hrLabel}>Human Resource on site</div>
        <div className={s.hrTotal}>{hrTotal}</div>
        {hrRoleNames.length === 0 ? (
          <p className={g.hintNote}>No Human Resource roles configured for this project yet — ask an admin to add them in Edit Project.</p>
        ) : (
          <div className={s.rolesGrid}>
            {hrRoleNames.map(role => (
              <Stepper key={role} label={role} value={roles[role] ?? 0} onChange={v => setRole(role, v)} />
            ))}
          </div>
        )}
      </div>

      <div className={g.actsHeader}>
        <span>Activities</span>
        <button type="button" className={g.addBtn} onClick={addRow}>+ Add row</button>
      </div>
      {activities.length > 0 && (
        <div className={g.actsColHead}>
          <span>Activity *</span>
          <span>Zone</span>
          <span>Area</span>
          <span />
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
        />
      ))}

      <WaPreview text={message} />

      <SubmitCopyBar text={message} saving={saving} error={error} onSubmit={save} />
    </div>
  );
}

// ── Blocker form ───────────────────────────────────────────────────────────────

// REPORTER_STAGES and ISSUE_OWNER_TYPES come from constants — no local definitions.
const OWNER_TYPE_BADGE = { int: g.badgeInt, ext: g.badgeExt, com: g.badgeCom };
const OWNER_TYPE_LABEL = Object.fromEntries(ISSUE_OWNER_TYPES.map(o => [o.value, o.label]));

function BlockerForm({ projectId, projectName, openIssues, contacts, date, reporterName, onSaved }) {
  const [mode, setMode]                 = useState('new');
  const [selectedId, setSelectedId]     = useState('');
  const [description, setDescription]   = useState('');
  const [ownerType, setOwnerType]       = useState('int');
  const [ownerName, setOwnerName]       = useState('');
  const [neededBy, setNeededBy]         = useState('');
  const [waitingOn, setWaitingOn]       = useState('');
  const [note, setNote]                 = useState('');
  const [stage, setStage]               = useState('raised');
  const [priority, setPriority]         = useState('');
  const [recur, setRecur]               = useState(false);
  const [photoInGroup, setPhotoInGroup] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const selected    = openIssues.find(i => i.id === selectedId);
  const displayDesc = mode === 'new' ? description : selected?.description ?? '';

  const message = buildBlockerMessage({
    projectName, date, mode, stage,
    description: displayDesc,
    ownerType: mode === 'new' ? ownerType : selected?.owner_type,
    ownerName: mode === 'new' ? ownerName : selected?.owner,
    neededBy, issueId: selectedId, note,
  });

  const changeMode = (m) => { setMode(m); setSelectedId(''); setError(''); };

  const save = async () => {
    if (!date) { setError('Date is required'); return false; }
    setError(''); setSaving(true);
    try {
      if (mode === 'new') {
        if (!description.trim()) { setSaving(false); setError('Description required'); return false; }
        await saveRecord({
          type: 'issue_new',
          project_id: projectId,
          description: description.trim(),
          owner: ownerName || null,
          owner_type: ownerType,
          stage: 'raised',
          priority: priority || null,
          waiting_on: waitingOn || null,
          needed_by: neededBy || null,
          photo_in_group: photoInGroup,
          raised_date: date,
          raw_text: message,
          reported_by: reporterName || null,
          source: 'form',
        });
        setDescription(''); setOwnerName(''); setNeededBy(''); setWaitingOn(''); setPriority('');
      } else {
        if (!selectedId) { setSaving(false); setError('Select an issue'); return false; }
        await saveRecord({
          type: 'issue_update',
          id: selectedId,
          stage,
          resolved_date: stage === 'resolved' ? date : null,
          recur,
          waiting_on: waitingOn || null,
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
      return true;
    } catch (e) {
      setError(e.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={g.entrySection}>
      <Eyebrow>Blocker / Issue</Eyebrow>

      <div className={s.modeTabs}>
        {[['new', 'New Issue'], ['update', 'Existing Issue']].map(([m, label]) => (
          <button key={m} type="button" className={cx(g.pill, mode === m && g.on)} onClick={() => changeMode(m)}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'new' ? (
        <>
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
              <SearchSelect
                items={(contacts ?? [])
                  .map(c => ({ label: c.contact_person || c.entity, tag: c.category || undefined }))
                  .filter(c => c.label)}
                value={ownerName}
                onChange={setOwnerName}
                placeholder="Select owner…"
              />
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
          <div className={g.fieldRow}>
            <label>Priority <span style={{ color: 'var(--steel)', fontWeight: 400 }}>(optional)</span></label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRIORITY_LEVELS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={cx(g.pill, priority === p.value && g.on)}
                  style={priority === p.value ? { background: p.color, borderColor: p.color } : {}}
                  onClick={() => setPriority(v => v === p.value ? '' : p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={g.fieldRow}>
            <label>Select issue *</label>
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
          <div className={g.fieldRow}>
            <label>Stage</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {REPORTER_STAGES.map(st => (
                <button
                  key={st.value}
                  type="button"
                  className={cx(g.pill, stage === st.value && g.on)}
                  style={stage === st.value && STAGE_COLORS[st.value] ? { background: STAGE_COLORS[st.value], borderColor: STAGE_COLORS[st.value] } : {}}
                  onClick={() => setStage(st.value)}
                >
                  {st.label}
                </button>
              ))}
            </div>
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

      <div className={g.fieldRow}>
        <label>Context / update</label>
        <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Context or update…" />
      </div>
      <label className={g.checkRow}>
        <input type="checkbox" checked={photoInGroup} onChange={e => setPhotoInGroup(e.target.checked)} />
        Photo shared in group
      </label>

      <WaPreview text={message} />

      <SubmitCopyBar text={message} saving={saving} error={error} onSubmit={save} />
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function FieldEntry() {
  const { user } = useAuth();

  const [projects, setProjects]             = useState([]);
  const [projectId, setProjectId]           = useState('');
  const [config, setConfig]                 = useState(null);
  const [liveZones, setLiveZones]           = useState([]);
  const [liveActivities, setLiveActivities] = useState([]);
  const [openIssues, setOpenIssues]         = useState([]);
  const [contacts, setContacts]             = useState([]);
  const [date, setDate]                     = useState(new Date().toISOString().slice(0, 10));
  // Pre-filled from login, left editable — a phone may be shared, or the
  // logged-in name may need correcting for this particular entry.
  const [reporterName, setReporter]         = useState(() => user.name || user.email);
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
      setContacts(d.contacts ?? []);
    }).catch(() => {});
  }, [projectId]);

  const project = projects.find(p => p.id === projectId);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), TOAST_MS); };

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
                MIS — Human Resource
              </button>
              <button className={cx(g.pill, tab === 'blocker' && g.on)} onClick={() => setTab('blocker')}>
                Blockers
              </button>
            </div>

            <div className={g.card}>
              {tab === 'mis' && (
                <MisForm
                  key={projectId}
                  projectId={projectId} projectName={project?.name}
                  config={config}
                  liveZones={liveZones}
                  liveActivities={liveActivities}
                  onAddActivity={handleAddActivity}
                  date={date} reporterName={reporterName}
                  onSaved={showToast}
                />
              )}
              {tab === 'blocker' && (
                <BlockerForm
                  projectId={projectId} projectName={project?.name}
                  openIssues={openIssues} contacts={contacts}
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
