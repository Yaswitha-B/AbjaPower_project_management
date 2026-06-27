import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchPortfolio, saveRecord } from '../api/client.js';
import Eyebrow from '../components/Eyebrow.jsx';
import g from '../styles/shared.module.css';
import { cx } from '../lib/cx.js';

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function suggestPrefix(name) {
  return name.trim().toUpperCase().split(/\s+/)[0].slice(0, 8);
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

const STATUS_COLOR = { active: 'var(--go)', inactive: 'var(--warn)', closed: 'var(--steel)' };

function ProjectRow({ p, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await saveRecord({ type: 'project_delete', id: p.id });
      onDelete(p.id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className={g.card} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
        <div style={{ fontSize: 12, color: 'var(--steel)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{p.discipline}</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            background: STATUS_COLOR[p.status] ?? 'var(--steel)',
            color: '#fff', borderRadius: 3, padding: '1px 6px',
          }}>{p.status}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {confirming ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--stop)' }}>Delete?</span>
            <button className={g.pill} style={{ fontSize: 12, background: 'var(--stop)', color: '#fff', borderColor: 'var(--stop)' }} onClick={handleDelete} disabled={deleting}>
              {deleting ? '…' : 'Yes'}
            </button>
            <button className={g.pill} style={{ fontSize: 12 }} onClick={() => setConfirming(false)}>No</button>
          </>
        ) : (
          <>
            <Link to={`/projects/${p.id}/edit`}>
              <button className={g.pill} style={{ fontSize: 12 }}>Edit</button>
            </Link>
            <button className={g.pill} style={{ fontSize: 12, color: 'var(--stop)', borderColor: 'var(--stop)' }} onClick={() => setConfirming(true)}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NewProject() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch]     = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const [name, setName]             = useState('');
  const [id, setId]                 = useState('');
  const [idPrefix, setIdPrefix]     = useState('');
  const [discipline, setDiscipline] = useState('');
  const [status, setStatus]         = useState('active');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [zones, setZones]           = useState([]);
  const [packages, setPackages]     = useState([]);
  const [activities, setActivities] = useState([]);
  const [contacts, setContacts]     = useState([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    fetchPortfolio().then((d) => setProjects(d.projects ?? [])).catch(() => {});
  }, []);

  const handleNameChange = (val) => {
    setName(val);
    if (!id || id === slugify(name))               setId(slugify(val));
    if (!idPrefix || idPrefix === suggestPrefix(name)) setIdPrefix(suggestPrefix(val));
  };

  const resetForm = () => {
    setName(''); setId(''); setIdPrefix(''); setDiscipline('');
    setStatus('active'); setStartDate(''); setEndDate('');
    setZones([]); setPackages([]); setActivities([]); setContacts([]); setError('');
  };

  const save = async () => {
    if (!name.trim())       return setError('Project name is required');
    if (!id.trim())         return setError('Project ID is required');
    if (!idPrefix.trim())   return setError('Issue prefix is required');
    if (!discipline.trim()) return setError('Discipline is required');
    const validContacts = contacts.filter(c => c.entity.trim());
    if (contacts.some(c => !c.entity.trim())) return setError('Each person must have an entity name');
    setError(''); setSaving(true);
    try {
      const result = await saveRecord({
        type: 'project_new',
        id: id.trim(),
        name: name.trim(),
        discipline: discipline.trim(),
        id_prefix: idPrefix.trim().toUpperCase(),
        towers: zones,
        work_packages: packages,
        activity_types: activities,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      if (validContacts.length) {
        await saveRecord({ type: 'contacts_replace', project_id: id.trim(), contacts: validContacts });
      }
      const created = result.project ?? { id: id.trim(), name: name.trim(), id_prefix: idPrefix.trim().toUpperCase(), discipline: discipline.trim(), status };
      setProjects((prev) => [created, ...prev]);
      resetForm();
      setFormOpen(false);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.discipline?.toLowerCase().includes(q) || p.lead?.toLowerCase().includes(q);
  });

  return (
    <section className={g.view}>
      <div className={g.wrap} style={{ maxWidth: 720 }}>

        <button
          onClick={() => { setFormOpen((o) => !o); setError(''); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: formOpen ? 'var(--ink)' : 'var(--card)',
            color: formOpen ? '#fff' : 'var(--ink)',
            border: `1px solid ${formOpen ? 'var(--ink)' : 'var(--line)'}`,
            borderRadius: 8, padding: '14px 18px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 700, marginBottom: formOpen ? 0 : 28,
          }}
        >
          <span>+ New Project</span>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{formOpen ? '−' : '+'}</span>
        </button>

        {formOpen && (
          <div style={{ border: '1px solid var(--ink)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '20px 0 4px', marginBottom: 28 }}>
            <div style={{ padding: '0 18px' }}>

              <div className={g.card}>
                <Eyebrow>Project identity</Eyebrow>

                <div className={g.fieldRow}>
                  <label>Project name *</label>
                  <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. VPNA Electrical, Sayuk MEP" />
                </div>

                <div className={cx(g.fieldRow, g.twoCol)}>
                  <div>
                    <label>Project ID * <span className={g.hint}>(URL slug, no spaces)</span></label>
                    <input
                      value={id}
                      onChange={e => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      placeholder="vpna-electrical"
                    />
                  </div>
                  <div>
                    <label>Issue prefix * <span className={g.hint}>(e.g. VPNA-01)</span></label>
                    <input
                      value={idPrefix}
                      onChange={e => setIdPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                      placeholder="VPNA"
                      style={{ fontFamily: 'var(--mono)' }}
                    />
                  </div>
                </div>

                <div className={g.fieldRow}>
                  <label>Discipline *</label>
                  <input list="disciplines" value={discipline} onChange={e => setDiscipline(e.target.value)} placeholder="Electrical, HVAC…" />
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
                <Eyebrow>Activity types</Eyebrow>
                <p className={g.hintNote} style={{ marginBottom: 16 }}>
                  These appear as dropdown options when field reporters submit daily MIS entries.
                  Reporters can also add new activities on the fly — they get appended here automatically.
                </p>
                <TagList label="Activity types" items={activities} onChange={setActivities} placeholder="Cable laying, Conduit, Panel / DB…  then press Enter" />
              </div>

              {error && <p className={g.formError} style={{ marginTop: 12 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 12, marginTop: 20, marginBottom: 8 }}>
                <button className={g.saveBtn} onClick={save} disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Creating project…' : 'Create project'}
                </button>
                <button className={g.pill} style={{ padding: '10px 20px' }} onClick={() => { resetForm(); setFormOpen(false); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
              <h2 className={g.title} style={{ margin: 0 }}>Projects <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 400, color: 'var(--steel)' }}>{projects.length}</span></h2>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by name, discipline, lead…"
                style={{ flex: 1, maxWidth: 280, fontSize: 13, padding: '7px 11px', border: '1px solid var(--line)', borderRadius: 7, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {filtered.length === 0
                ? <p style={{ color: 'var(--steel)', fontSize: 13 }}>No projects match "{search}".</p>
                : filtered.map((p) => (
                    <ProjectRow
                      key={p.id}
                      p={p}
                      onDelete={(deletedId) => setProjects((prev) => prev.filter((x) => x.id !== deletedId))}
                    />
                  ))
              }
            </div>
          </>
        )}

      </div>
    </section>
  );
}
