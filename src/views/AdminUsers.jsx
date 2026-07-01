import { useEffect, useState } from 'react';
import { fetchUsers, fetchPortfolio, saveRecord } from '../api/client.js';
import { USER_ROLES } from '../lib/constants.js';
import Eyebrow from '../components/Eyebrow.jsx';
import SearchSelect from '../components/SearchSelect.jsx';
import g from '../styles/shared.module.css';

const ROLE_COLOR = { admin: 'var(--orange)', curator: 'var(--blue)', reporter: 'var(--steel)' };

function scopeLabel(u, projects) {
  if (!u.project_ids?.length) return 'All projects';
  const names = u.project_ids.map(id => projects.find(p => p.id === id)?.name ?? id);
  return names.join(', ');
}

function UserRow({ u, projects, onEdit, onChanged }) {
  const [role, setRole]             = useState(u.role);
  const [saving, setSaving]         = useState(false);
  const [confirming, setConfirming] = useState(false);

  const changeRole = async (newRole) => {
    setRole(newRole); setSaving(true);
    try {
      // project_ids intentionally omitted — changing only the role must not
      // touch an existing project scope.
      await saveRecord({ type: 'user_upsert', email: u.email, name: u.name, role: newRole });
      onChanged();
    } catch {
      setRole(u.role);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await saveRecord({ type: 'user_remove', email: u.email });
      onChanged();
    } catch {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <div className={g.card} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <button
        type="button"
        onClick={() => onEdit(u)}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        title="Click to edit"
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name || u.email}</div>
        {u.name && <div style={{ fontSize: 12, color: 'var(--steel)', marginTop: 2 }}>{u.email}</div>}
        <div style={{ fontSize: 11.5, color: 'var(--steel)', marginTop: 2 }}>{scopeLabel(u, projects)}</div>
      </button>
      <select
        value={role}
        disabled={saving}
        onChange={e => changeRole(e.target.value)}
        style={{
          width: 'auto', flexShrink: 0,
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          color: ROLE_COLOR[role], border: `1px solid ${ROLE_COLOR[role]}`, borderRadius: 4,
          background: 'transparent', padding: '3px 8px',
        }}
        aria-label={`Role for ${u.name || u.email}`}
      >
        {USER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {confirming ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--stop)' }}>Remove?</span>
            <button className={g.pill} style={{ fontSize: 12, background: 'var(--stop)', color: '#fff', borderColor: 'var(--stop)' }} onClick={remove} disabled={saving}>
              {saving ? '…' : 'Yes'}
            </button>
            <button className={g.pill} style={{ fontSize: 12 }} onClick={() => setConfirming(false)}>No</button>
          </>
        ) : (
          <button className={g.pill} style={{ fontSize: 12, color: 'var(--stop)', borderColor: 'var(--stop)' }} onClick={() => setConfirming(true)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM = { email: '', name: '', role: 'reporter', projectIds: [] };

export default function AdminUsers() {
  const [users, setUsers]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editingEmail, setEditingEmail] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const reload = () => fetchUsers().then(d => setUsers(d.users ?? [])).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => {
    reload();
    fetchPortfolio().then(d => setProjects(d.projects ?? [])).catch(() => {});
  }, []);

  const startEdit = (u) => {
    setEditingEmail(u.email);
    setForm({ email: u.email, name: u.name || '', role: u.role, projectIds: u.project_ids ?? [] });
    setError('');
  };

  const cancelEdit = () => {
    setEditingEmail(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const toggleProject = (id) => {
    setForm(f => ({
      ...f,
      projectIds: f.projectIds.includes(id) ? f.projectIds.filter(p => p !== id) : [...f.projectIds, id],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return setError('Email is required');
    setError(''); setSaving(true);
    try {
      await saveRecord({
        type: 'user_upsert',
        email: form.email.trim(),
        name: form.name.trim() || null,
        role: form.role,
        project_ids: form.projectIds,
      });
      cancelEdit();
      reload();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={g.view}>
      <div className={g.wrap} style={{ maxWidth: 640 }}>
        <h2 className={g.title}>Users & Access</h2>
        <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 24 }}>
          Add an email to grant access. Anyone not listed here cannot sign in, even if they verify a code.
        </p>

        <div className={g.card} style={{ marginBottom: 24 }}>
          <Eyebrow>{editingEmail ? `Editing ${editingEmail}` : 'Add / update access'}</Eyebrow>
          <form onSubmit={submit}>
            <div className={g.fieldRow}>
              <label>Email *</label>
              <input
                type="email" value={form.email} disabled={!!editingEmail}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="name@company.com"
              />
            </div>
            <div className={g.fieldRow}>
              <label>Name <span className={g.hint}>(optional)</span></label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Display name" />
            </div>
            <div className={g.fieldRow}>
              <label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {USER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className={g.fieldRow}>
              <label>Projects <span className={g.hint}>(leave empty for access to every project)</span></label>
              {projects.length === 0 ? (
                <p className={g.hintNote}>No projects created yet.</p>
              ) : (
                <>
                  <div className={g.tagList}>
                    {form.projectIds.map(id => (
                      <span key={id} className={g.tag}>
                        {projects.find(p => p.id === id)?.name ?? id}
                        <button type="button" onClick={() => toggleProject(id)} aria-label="Remove">×</button>
                      </span>
                    ))}
                    {form.projectIds.length === 0 && (
                      <span className={g.hintNote} style={{ alignSelf: 'center' }}>None added — access to all projects</span>
                    )}
                  </div>
                  <SearchSelect
                    items={projects.filter(p => !form.projectIds.includes(p.id)).map(p => p.name)}
                    value=""
                    placeholder="Add a project…"
                    onChange={(name) => {
                      const p = projects.find(pr => pr.name === name);
                      if (p) toggleProject(p.id);
                    }}
                  />
                </>
              )}
            </div>
            {error && <p className={g.formError}>⚠ {error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={g.saveBtn} type="submit" disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Saving…' : editingEmail ? 'Save changes' : 'Add / update'}
              </button>
              {editingEmail && (
                <button type="button" className={g.pill} onClick={cancelEdit} style={{ padding: '0 18px' }}>Cancel</button>
              )}
            </div>
          </form>
        </div>

        {loading ? (
          <div className={g.loading}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {users.length === 0
              ? <p style={{ color: 'var(--steel)', fontSize: 13 }}>No one has access yet.</p>
              : users.map(u => <UserRow key={u.email} u={u} projects={projects} onEdit={startEdit} onChanged={reload} />)}
          </div>
        )}
      </div>
    </section>
  );
}
