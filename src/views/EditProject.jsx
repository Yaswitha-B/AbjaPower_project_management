import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchProject, saveRecord } from '../api/client.js';
import Eyebrow from '../components/Eyebrow.jsx';
import g from '../styles/shared.module.css';
import { cx } from '../lib/cx.js';

const EMPTY_PERSON = () => ({ entity: '', contact_person: '', contact_number: '', email: '', category: 'other', party_type: 'internal' });

function PersonCard({ person, onChange, onRemove, index }) {
  const set = (key, val) => onChange({ ...person, [key]: val });
  return (
    <div className={g.personCard}>
      <div className={g.personCardTop}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--steel)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Person {index + 1}
        </span>
        <button type="button" className={g.rmBtn} onClick={onRemove} title="Remove">×</button>
      </div>
      <div className={g.personFieldsGrid}>
        <div className={g.full}>
          <label>Entity *</label>
          <input value={person.entity} onChange={e => set('entity', e.target.value)} placeholder="Company or organisation name" />
        </div>
        <div>
          <label>Contact person</label>
          <input value={person.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label>Contact number</label>
          <input value={person.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="+91 …" />
        </div>
        <div className={g.full}>
          <label>Email</label>
          <input type="email" value={person.email} onChange={e => set('email', e.target.value)} placeholder="name@example.com" />
        </div>
        <div>
          <label>Category</label>
          <select value={person.category} onChange={e => set('category', e.target.value)}>
            <option value="design">Design</option>
            <option value="management">Management</option>
            <option value="customer">Customer</option>
            <option value="sub_contractor">Sub-contractor</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label>Type</label>
          <select value={person.party_type} onChange={e => set('party_type', e.target.value)}>
            <option value="internal">Internal</option>
            <option value="customer">Customer</option>
            <option value="supplier_contractor">Supplier / Contractor</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function TagList({ label, hint, items, onChange, placeholder }) {
  const [input, setInput] = useState('');

  const add = () => {
    const val = input.trim();
    if (!val || items.includes(val)) return;
    onChange([...items, val]);
    setInput('');
  };

  const remove = (i) => onChange(items.filter((_, j) => j !== i));

  return (
    <div className={g.fieldRow}>
      <label>
        {label}
        {hint && <span className={g.hint}> ({hint})</span>}
      </label>
      <div className={g.tagList}>
        {items.map((item, i) => (
          <span key={i} className={g.tag}>
            {item}
            <button type="button" onClick={() => remove(i)} aria-label="Remove">×</button>
          </span>
        ))}
        {items.length === 0 && <span className={g.hintNote} style={{ alignSelf: 'center' }}>None added yet</span>}
      </div>
      <div className={g.tagInputRow}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button type="button" className={g.addBtn} onClick={add}>Add</button>
      </div>
    </div>
  );
}

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]       = useState(true);
  const [name, setName]             = useState('');
  const [discipline, setDiscipline] = useState('');
  const [status, setStatus]         = useState('active');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [zones, setZones]           = useState([]);
  const [packages, setPackages]     = useState([]);
  const [activities, setActivities] = useState([]);
  const [hrRoles, setHrRoles]       = useState([]);
  const [contacts, setContacts]     = useState([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    fetchProject(id)
      .then((d) => {
        const p = d.config ?? d.summary ?? d;
        setName(p.name ?? '');
        setDiscipline(p.discipline ?? '');
        setStatus(p.status ?? 'active');
        setStartDate(p.start_date?.slice(0, 10) ?? '');
        setEndDate(p.end_date?.slice(0, 10) ?? '');
        setZones(p.towers ?? []);
        setPackages(p.work_packages ?? []);
        setActivities(p.activity_types ?? []);
        setHrRoles(p.hr_roles ?? []);
        setContacts(d.contacts ?? []);
      })
      .catch(() => setError('Failed to load project'))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!name.trim())       return setError('Project name is required');
    if (!discipline.trim()) return setError('Discipline is required');
    if (contacts.some(c => !c.entity.trim())) return setError('Each person must have an entity name');
    setError(''); setSaving(true);
    try {
      await Promise.all([
        saveRecord({
          type: 'project_edit',
          id,
          name: name.trim(),
          discipline: discipline.trim(),
          status,
          start_date: startDate || null,
          end_date: endDate || null,
          towers: zones,
          work_packages: packages,
          activity_types: activities,
          hr_roles: hrRoles,
        }),
        saveRecord({
          type: 'contacts_replace',
          project_id: id,
          contacts: contacts.filter(c => c.entity.trim()),
        }),
      ]);
      navigate(`/projects/${id}`);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className={g.view}><div className={g.wrap}>Loading…</div></section>;

  return (
    <section className={g.view}>
      <div className={g.wrap} style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 4 }}>
          <h2 className={g.title}>Edit Project</h2>
          <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--steel)' }}>{id}</code>
        </div>
        <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 28 }}>
          Project ID and issue prefix cannot be changed — they are referenced by all existing issues.
        </p>

        <div className={g.card}>
          <Eyebrow>Project identity</Eyebrow>

          <div className={g.fieldRow}>
            <label>Project name *</label>
            <input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className={g.fieldRow}>
            <label>Discipline *</label>
            <input
              list="disciplines"
              value={discipline}
              onChange={e => setDiscipline(e.target.value)}
              placeholder="Electrical, HVAC, Plumbing…"
            />
            <datalist id="disciplines">
              <option value="Electrical" /><option value="HVAC" /><option value="Plumbing" />
              <option value="Fire Fighting" /><option value="Fire Alarm" /><option value="ELV" />
              <option value="MEP" /><option value="Civil" /><option value="Facade" />
            </datalist>
          </div>

          <div className={g.fieldRow}>
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className={cx(g.fieldRow, g.twoCol)}>
            <div>
              <label>Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label>End date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className={g.card} style={{ marginTop: 16 }}>
          <Eyebrow>People in loop</Eyebrow>
          <p className={g.hintNote} style={{ marginBottom: 14 }}>
            Key contacts for this project — site team, client, contractors, consultants.
          </p>
          <div className={g.peopleList}>
            {contacts.map((p, i) => (
              <PersonCard
                key={i} person={p} index={i}
                onChange={val => setContacts(prev => prev.map((x, j) => j === i ? val : x))}
                onRemove={() => setContacts(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>
          <button type="button" className={g.addBtn} onClick={() => setContacts(prev => [...prev, EMPTY_PERSON()])}>
            + Add person
          </button>
        </div>

        <div className={g.card} style={{ marginTop: 16 }}>
          <Eyebrow>Scope</Eyebrow>
          <TagList label="Zones" hint="site structure" items={zones} onChange={setZones} placeholder="Tower 1, Podium, B1…  then press Enter" />
          <TagList label="Work packages" hint="groups for MIS reporting" items={packages} onChange={setPackages} placeholder="MEP, HVAC, Fire Fighting…  then press Enter" />
        </div>

        <div className={g.card} style={{ marginTop: 16 }}>
          <Eyebrow>Human Resource roles</Eyebrow>
          <TagList label="Human Resource roles" items={hrRoles} onChange={setHrRoles} placeholder="Engineer, Welder, Project Manager…  then press Enter" />
        </div>

        <div className={g.card} style={{ marginTop: 16 }}>
          <Eyebrow>Activity types</Eyebrow>
          <TagList label="Activity types" items={activities} onChange={setActivities} placeholder="Cable laying, Conduit, Panel / DB…  then press Enter" />
        </div>

        {error && <p className={g.formError} style={{ marginTop: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button className={g.saveBtn} onClick={save} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <Link to={`/projects/${id}`}>
            <button className={g.pill} style={{ padding: '10px 20px' }}>Cancel</button>
          </Link>
        </div>
      </div>
    </section>
  );
}
