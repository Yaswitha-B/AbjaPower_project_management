import {
  getProjects, getProject, getProjectConfig,
  getMonthlyTrend, getActivityBreakdown, getTowerBreakdown,
  getIssues, getOpenIssues, getCertEvents, getLatestSignals,
  getContacts, getAllMisRows, getAllIssues,
  getUnverifiedMis, getUnverifiedIssues, getSightings,
} from '../../lib/db.js';

export default async (req) => {
  const url      = new URL(req.url);
  const id       = url.searchParams.get('project');
  const curator  = url.searchParams.get('curator');
  const issueId  = url.searchParams.get('sightings');

  try {
    if (issueId) {
      const sightings = await getSightings(issueId);
      return Response.json({ sightings });
    }

    if (curator === 'mis') {
      const rows = await getAllMisRows();
      return Response.json({ rows });
    }
    if (curator === 'issues') {
      const issues = await getAllIssues();
      return Response.json({ issues });
    }
    if (curator === 'mis_unverified') {
      const rows = await getUnverifiedMis(id || null);
      return Response.json({ rows });
    }
    if (curator === 'issues_unverified') {
      const issues = await getUnverifiedIssues(id || null);
      return Response.json({ issues });
    }

    if (!id) {
      const projects = await getProjects();
      return Response.json({ projects });
    }

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
