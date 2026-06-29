import {
  insertMisRow, updateMisRow,
  insertIssue, updateIssue, patchIssue,
  insertSighting,
  nextIssueId,
  createProject, updateProject, deleteProject,
  addProjectActivity, addProjectZone,
  replaceContacts,
  markMisVerified, markIssueVerified,
  markIssueUnverified, markMisUnverified,
} from '../../lib/db.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, ...data } = body;

  try {
    switch (type) {
      case 'mis_row': {
        const result = await insertMisRow(data);
        return Response.json({ ok: true, row: result });
      }

      case 'issue_new': {
        if (!data.id) data.id = await nextIssueId(data.project_id);
        const result = await insertIssue(data);
        if (data.raw_text || data.source === 'form') {
          await insertSighting({
            issue_id:       data.id,
            source:         data.source ?? 'form',
            date:           data.raised_date,
            raw_text:       data.raw_text,
            implied_status: 'Pending',
            photo_in_group: data.photo_in_group,
            reported_by:    data.reported_by,
          });
        }
        return Response.json({ ok: true, issue: result });
      }

      case 'issue_update': {
        const { id, ...patch } = data;
        const result = await updateIssue(id, patch);
        await markIssueUnverified(id);
        const stageLabel = patch.stage === 'resolved' ? 'Resolved' : patch.stage === 'updated' ? 'Updated' : 'Raised';
        await insertSighting({
          issue_id:       id,
          source:         data.source ?? 'form',
          date:           data.date ?? new Date().toISOString().slice(0, 10),
          raw_text:       patch.raw_text ?? patch.note ?? stageLabel,
          implied_status: patch.stage === 'resolved' ? 'Actioned' : 'Pending',
          photo_in_group: patch.photo_in_group ?? false,
          reported_by:    data.reported_by,
        });
        return Response.json({ ok: true, issue: result });
      }

      case 'sighting': {
        const result = await insertSighting(data);
        return Response.json({ ok: true, sighting: result });
      }

      case 'project_new': {
        const result = await createProject(data);
        return Response.json({ ok: true, project: result });
      }

      case 'project_delete': {
        const { id } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        await deleteProject(id);
        return Response.json({ ok: true });
      }

      case 'project_edit': {
        const { id, ...patch } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await updateProject(id, patch);
        if (!result) return Response.json({ error: 'Project not found' }, { status: 404 });
        return Response.json({ ok: true, project: result });
      }

      case 'project_add_activity': {
        const { project_id, activity } = data;
        if (!project_id || !activity) {
          return Response.json({ error: 'project_id and activity required' }, { status: 400 });
        }
        const result = await addProjectActivity(project_id, activity);
        return Response.json({ ok: true, activity_types: result?.activity_types ?? [] });
      }

      case 'project_add_zone': {
        const { project_id, zone } = data;
        if (!project_id || !zone) {
          return Response.json({ error: 'project_id and zone required' }, { status: 400 });
        }
        const result = await addProjectZone(project_id, zone);
        return Response.json({ ok: true, towers: result?.towers ?? [] });
      }

      case 'mis_update': {
        const { id, ...patch } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await updateMisRow(id, patch);
        if (!result) return Response.json({ error: 'Row not found' }, { status: 404 });
        return Response.json({ ok: true, row: result });
      }

      case 'issue_patch': {
        const { id, ...patch } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await patchIssue(id, patch);
        if (!result) return Response.json({ error: 'Issue not found' }, { status: 404 });
        return Response.json({ ok: true, issue: result });
      }

      case 'contacts_replace': {
        const { project_id, contacts } = data;
        if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });
        const result = await replaceContacts(project_id, contacts ?? []);
        return Response.json({ ok: true, contacts: result });
      }

      case 'mis_verify': {
        const { id, verified_by, flag } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await markMisVerified(id, verified_by, flag ?? null);
        if (!result) return Response.json({ error: 'Row not found' }, { status: 404 });
        return Response.json({ ok: true, row: result });
      }

      case 'issue_verify': {
        const { id, verified_by, flag } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await markIssueVerified(id, verified_by, flag ?? null);
        if (!result) return Response.json({ error: 'Issue not found' }, { status: 404 });
        return Response.json({ ok: true, issue: result });
      }

      case 'issue_unverify': {
        const { id } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await markIssueUnverified(id);
        if (!result) return Response.json({ error: 'Issue not found' }, { status: 404 });
        return Response.json({ ok: true, issue: result });
      }

      case 'mis_unverify': {
        const { id } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await markMisUnverified(id);
        if (!result) return Response.json({ error: 'Row not found' }, { status: 404 });
        return Response.json({ ok: true, row: result });
      }

      default:
        return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (err) {
    console.error('write error', err);
    return Response.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
};

export const config = { path: '/api/write' };
