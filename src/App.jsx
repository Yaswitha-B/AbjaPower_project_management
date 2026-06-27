import { useEffect, useState } from 'react';
import { Link, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { fetchPortfolio } from './api/client.js';
import Overview from './views/Overview.jsx';
import ProjectView from './views/ProjectView.jsx';
import FieldEntry from './views/FieldEntry.jsx';
import Curation from './views/Curation.jsx';
import CuratorsPanel from './views/CuratorsPanel.jsx';
import NewProject from './views/NewProject.jsx';
import EditProject from './views/EditProject.jsx';
import Login from './views/Login.jsx';
import s from './App.module.css';
import g from './styles/shared.module.css';
import { cx } from './lib/cx.js';
import { AUTH_KEY } from './lib/constants.js';

function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === '1';
}

function RequireAuth({ children }) {
  return isAuthed() ? children : <Navigate to="/login" replace />;
}

function TopBar({ onLogout }) {
  return (
    <div className={s.top}>
      <div className={cx(g.wrap, s.topInner)}>
        <div className={s.brand}>
          <b>ABJA</b> Power
          <span>Project Review Board</span>
        </div>
        {isAuthed() && (
          <button onClick={onLogout} className={s.logoutBtn}>
            Log out
          </button>
        )}
      </div>
    </div>
  );
}

function NavPill({ to, active, children, accent, badge }) {
  return (
    <Link to={to}>
      <span className={s.navPillWrap}>
        <button
          className={cx(g.pill, active && g.on, active && accent && g.ov)}
          style={!active && accent ? { borderColor: accent, color: accent } : undefined}
        >
          {children}
        </button>
        {badge > 0 && <span className={s.issueBadge}>{badge > 99 ? '99+' : badge}</span>}
      </span>
    </Link>
  );
}

function Nav({ projects }) {
  const { pathname } = useLocation();

  const isEntry    = pathname === '/entry';
  const isCuration = pathname === '/curation';
  const isCurator  = pathname === '/curator';
  const isNewProj  = pathname === '/projects/new';
  const isOverview = pathname === '/';

  const totalOpen = projects.reduce((s, p) => s + Number(p.open_blockers ?? 0), 0);

  return (
    <nav className={s.nav} aria-label="Main navigation">
      <div className={cx(g.wrap, s.navInner)}>
        {/* Left: overview + projects + curators */}
        <NavPill to="/" active={isOverview} accent="var(--blue)" badge={totalOpen}>Overview</NavPill>

        {projects.map((p) => (
          <NavPill
            key={p.id}
            to={`/projects/${p.id}`}
            active={pathname === `/projects/${p.id}`}
            badge={Number(p.open_blockers ?? 0)}
          >
            {p.name}
          </NavPill>
        ))}

        <NavPill to="/curator" active={isCurator}>Curators Panel</NavPill>

        {/* Divider between read views and action views */}
        <span className={s.spacer} />
        <span className={s.navDivider} />

        {/* Right: action buttons */}
        <NavPill to="/entry" active={isEntry} accent="var(--orange)">
          + Field Entry
        </NavPill>
        <NavPill to="/curation" active={isCuration}>Curation</NavPill>
        <NavPill to="/projects/new" active={isNewProj}>+ Project</NavPill>
      </div>
    </nav>
  );
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [authed, setAuthed]     = useState(isAuthed());
  const navigate                = useNavigate();

  useEffect(() => {
    if (!authed) return;
    fetchPortfolio()
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, [authed]);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuthed(false);
    navigate('/login');
  };

  const handleLogin = () => {
    setAuthed(true);
    fetchPortfolio()
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  };

  return (
    <>
      {authed && <TopBar onLogout={handleLogout} />}
      {authed && <Nav projects={projects} />}
      <Routes>
        <Route path="/login" element={<Login onSuccess={handleLogin} />} />
        <Route path="/" element={<RequireAuth><Overview /></RequireAuth>} />
        <Route path="/projects/new" element={<RequireAuth><NewProject /></RequireAuth>} />
        <Route path="/projects/:id/edit" element={<RequireAuth><EditProject /></RequireAuth>} />
        <Route path="/projects/:id" element={<RequireAuth><ProjectView /></RequireAuth>} />
        <Route path="/entry" element={<RequireAuth><FieldEntry /></RequireAuth>} />
        <Route path="/curation" element={<RequireAuth><Curation /></RequireAuth>} />
        <Route path="/curator" element={<RequireAuth><CuratorsPanel /></RequireAuth>} />
      </Routes>
    </>
  );
}
