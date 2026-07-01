import {
  getProjects, getProject, getProjectConfig,
  getMonthlyTrend, getActivityBreakdown, getTowerBreakdown,
  getIssues, getOpenIssues, getCertEvents, getLatestSignals,
  getContacts, getAllMisRows, getAllIssues,
  getUnverifiedMis, getUnverifiedIssues, getSightings,
  getAllUserRoles, getIssueProjectId,
} from '../../lib/db.js';
import { verifySession } from '../../lib/auth.js';

// Empty project_ids means "all projects" — a scoped list narrows every read
// below to just those. Same rule as write.js.
function inScope(user, projectId) {
  return !user.project_ids?.length || user.project_ids.includes(projectId);
}

export default async (req) => {
  try {
    const user = await verifySession(req);
    if (!user) return Response.json({ error: 'Not authorized' }, { status: 401 });

    const url      = new URL(req.url);
    const id       = url.searchParams.get('project');
    const curator  = url.searchParams.get('curator');
    const issueId  = url.searchParams.get('sightings');
    const admin    = url.searchParams.get('admin');

    // Reporters get portfolio/project reads (what Field Entry needs) — not the
    // curator queue, issue history, or admin data, even via a direct API call.
    if (user.role === 'reporter' && (curator || admin || issueId)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (admin === 'users') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const users = await getAllUserRoles();
      return Response.json({ users });
    }

    if (issueId) {
      const issueProjectId = await getIssueProjectId(issueId);
      if (issueProjectId && !inScope(user, issueProjectId)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const sightings = await getSightings(issueId);
      return Response.json({ sightings });
    }

    // Bulk curator queries aren't project-filtered in SQL — filtering the
    // (small) result set here is simpler than threading project_ids into
    // every query, and fine at this app's scale.
    if (curator === 'mis') {
      const rows = await getAllMisRows();
      return Response.json({ rows: rows.filter(r => inScope(user, r.project_id)) });
    }
    if (curator === 'issues') {
      const issues = await getAllIssues();
      return Response.json({ issues: issues.filter(i => inScope(user, i.project_id)) });
    }
    if (curator === 'mis_unverified') {
      if (id && !inScope(user, id)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const rows = await getUnverifiedMis(id || null);
      return Response.json({ rows: id ? rows : rows.filter(r => inScope(user, r.project_id)) });
    }
    if (curator === 'issues_unverified') {
      if (id && !inScope(user, id)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const issues = await getUnverifiedIssues(id || null);
      return Response.json({ issues: id ? issues : issues.filter(i => inScope(user, i.project_id)) });
    }

    if (!id) {
      const projects = await getProjects();
      return Response.json({ projects: projects.filter(p => inScope(user, p.id)) });
    }

    if (!inScope(user, id)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [summary, config, trend, activities, towers, issues, openIssues, certEvents, signals, contacts] = await Promise.all([
      getProject(id),
      getProjectConfig(id),
      getMonthlyTrend(id),
      getActivityBreakdown(id),
      getTowerBreakdown(id),
      getIssues(id),
      getOpenIssues(id),
      getCertEvents(id),
      getLatestSignals(id),
      getContacts(id),
    ]);

    if (!summary) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({ summary, config, trend, activities, towers, issues, openIssues, certEvents, signals, contacts });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

export const config = { path: '/api/read' };
