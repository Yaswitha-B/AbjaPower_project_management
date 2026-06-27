import { useState } from 'react';
import Eyebrow from '../components/Eyebrow.jsx';
import g from '../styles/shared.module.css';
import s from './Curation.module.css';
import { cx } from '../lib/cx.js';

function PlaceholderCard({ title, description, note }) {
  return (
    <div className={cx(g.card, s.placeholderCard)}>
      <Eyebrow>{title}</Eyebrow>
      <p style={{ color: 'var(--steel)', fontSize: 13.5, lineHeight: 1.7, marginBottom: 14 }}>{description}</p>
      <div className={s.placeholderNotice}>
        <span className={s.noticeDot} />
        {note}
      </div>
    </div>
  );
}

export default function Curation() {
  const [tab, setTab] = useState('chat');

  return (
    <section className={g.view}>
      <div className={g.wrap} style={{ maxWidth: 720 }}>
        <h2 className={g.title}>Curation Tool</h2>
        <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 24 }}>
          The curation tool lets a data steward review WhatsApp group exports day-by-day,
          correct auto-detected entries, and commit them to the database in bulk.
        </p>

        <div className={g.subtabs} style={{ marginBottom: 24 }}>
          <button className={cx(g.pill, tab === 'chat' && g.on, tab === 'chat' && g.ov)} onClick={() => setTab('chat')}>Chat Parse</button>
          <button className={cx(g.pill, tab === 'minutes' && g.on)} onClick={() => setTab('minutes')}>Meeting Minutes</button>
        </div>

        {tab === 'chat' && (
          <PlaceholderCard
            title="Chat Parse"
            description="Upload or paste a WhatsApp group export. The tool will split messages by day, detect manpower totals, activity rows, and blocker candidates — then let you edit the parsed card before committing to the database."
            note="In development — chat parsing pipeline is being built"
          />
        )}

        {tab === 'minutes' && (
          <PlaceholderCard
            title="AI Meeting Minutes"
            description="Paste your site meeting notes and Claude will extract action items, decisions, and blockers — mapped directly to your project's issue tracker as pre-filled drafts ready for your review."
            note="In development — requires Claude API integration (parser.js function)"
          />
        )}

        <p className={g.hintNote} style={{ marginTop: 28, textAlign: 'center' }}>
          In the meantime, use <strong>Field Entry</strong> for daily MIS and blocker submissions.
        </p>
      </div>
    </section>
  );
}
