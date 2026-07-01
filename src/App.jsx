import { useEffect, useState } from 'react';
import { Link, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { fetchPortfolio } from './api/client.js';
import { useAuth } from './lib/AuthContext.jsx';
import Overview from './views/Overview.jsx';
import ProjectView from './views/ProjectView.jsx';
import FieldEntry from './views/FieldEntry.jsx';
import Curation from './views/Curation.jsx';
import CuratorsPanel from './views/CuratorsPanel.jsx';
import NewProject from './views/NewProject.jsx';
import EditProject from './views/EditProject.jsx';
import AdminUsers from './views/AdminUsers.jsx';
import Login from './views/Login.jsx';
import s from './App.module.css';
import g from './styles/shared.module.css';
import { cx } from './lib/cx.js';

// roles omitted = any logged-in role. Failing the check always lands on
// /entry — the one page every role is guaranteed to have access to.
function RequireAuth({ roles, children }) {
  const { user, checking } = useAuth();
  if (checking) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/entry" replace />;
  return children;
}

function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={s.top}>
      <div className={cx(g.wrap, s.topInner)}>
        <div className={s.brand}>
          <b>ABJA</b> Power
          <span>Project Review Board</span>
        </div>
        {user && (
          <div className={s.topInner} style={{ gap: 12 }}>
            <span style={{ fontSize: 12.5, color: 'var(--steel)' }}>{user.name || user.email}</span>
            <button onClick={() => { logout(); navigate('/login'); }} className={s.logoutBtn}>
              Log out
            </button>
          </div>
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
  const { user }     = useAuth();

  const isEntry    = pathname === '/entry';
  const isCuration = pathname === '/curation';
  const isCurator  = pathname === '/curator';
  const isNewProj  = pathname === '/projects/new';
  const isUsers    = pathname === '/admin/users';
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
        {user?.role === 'admin' && (
          <NavPill to="/admin/users" active={isUsers}>Users</NavPill>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const { user, login }         = useAuth();

  useEffect(() => {
    if (!user) return;
    fetchPortfolio()
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, [user]);

  return (
    <>
      {user && <TopBar />}
      {user && user.role !== 'reporter' && <Nav projects={projects} />}
      <Routes>
        <Route path="/login" element={<Login onSuccess={login} />} />
        <Route path="/" element={<RequireAuth roles={['admin', 'curator']}><Overview /></RequireAuth>} />
        <Route path="/projects/new" element={<RequireAuth roles={['admin', 'curator']}><NewProject /></RequireAuth>} />
        <Route path="/projects/:id/edit" element={<RequireAuth roles={['admin', 'curator']}><EditProject /></RequireAuth>} />
        <Route path="/projects/:id" element={<RequireAuth roles={['admin', 'curator']}><ProjectView /></RequireAuth>} />
        <Route path="/entry" element={<RequireAuth><FieldEntry /></RequireAuth>} />
        <Route path="/curation" element={<RequireAuth roles={['admin', 'curator']}><Curation /></RequireAuth>} />
        <Route path="/curator" element={<RequireAuth roles={['admin', 'curator']}><CuratorsPanel /></RequireAuth>} />
        <Route path="/admin/users" element={<RequireAuth roles={['admin']}><AdminUsers /></RequireAuth>} />
      </Routes>
    </>
  );
}
