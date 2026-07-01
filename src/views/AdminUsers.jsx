import { useEffect, useState } from 'react';
import { fetchUsers, saveRecord } from '../api/client.js';
import { USER_ROLES } from '../lib/constants.js';
import Eyebrow from '../components/Eyebrow.jsx';
import g from '../styles/shared.module.css';

const ROLE_COLOR = { admin: 'var(--orange)', curator: 'var(--blue)', reporter: 'var(--steel)' };

function UserRow({ u, onChanged }) {
  const [role, setRole]         = useState(u.role);
  const [saving, setSaving]     = useState(false);
  const [confirming, setConfirming] = useState(false);

  const changeRole = async (newRole) => {
    setRole(newRole); setSaving(true);
    try {
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name || u.email}</div>
        {u.name && <div style={{ fontSize: 12, color: 'var(--steel)', marginTop: 2 }}>{u.email}</div>}
      </div>
      <select
        value={role}
        disabled={saving}
        onChange={e => changeRole(e.target.value)}
        style={{
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          color: ROLE_COLOR[role], border: `1px solid ${ROLE_COLOR[role]}`, borderRadius: 4,
          background: 'transparent', padding: '3px 8px',
        }}
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

export default function AdminUsers() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [role, setRole]         = useState('reporter');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const reload = () => fetchUsers().then(d => setUsers(d.users ?? [])).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => { reload(); }, []);

  const addUser = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setError('Email is required');
    setError(''); setSaving(true);
    try {
      await saveRecord({ type: 'user_upsert', email: email.trim(), name: name.trim() || null, role });
      setEmail(''); setName(''); setRole('reporter');
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
          <Eyebrow>Add / update access</Eyebrow>
          <form onSubmit={addUser}>
            <div className={g.fieldRow}>
              <label>Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className={g.fieldRow}>
              <label>Name <span className={g.hint}>(optional)</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Display name" />
            </div>
            <div className={g.fieldRow}>
              <label>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}>
                {USER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {error && <p className={g.formError}>⚠ {error}</p>}
            <button className={g.saveBtn} type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add / update'}
            </button>
          </form>
        </div>

        {loading ? (
          <div className={g.loading}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {users.length === 0
              ? <p style={{ color: 'var(--steel)', fontSize: 13 }}>No one has access yet.</p>
              : users.map(u => <UserRow key={u.email} u={u} onChanged={reload} />)}
          </div>
        )}
      </div>
    </section>
  );
}
