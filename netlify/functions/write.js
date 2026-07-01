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
  logActivity,
  upsertUserRole, deleteUserRole,
} from '../../lib/db.js';
import { verifySession } from '../../lib/auth.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const user = await verifySession(req);
  if (!user) return Response.json({ error: 'Not authorized' }, { status: 401 });

  // Single source of truth for "who did this" — never trust a client-sent name.
  const actor = user.name || user.email;

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, ...data } = body;

  // Reporters are confined to what Field Entry actually does — everything
  // else (curation, verification, project/user management) requires
  // admin or curator. Checked once, here, rather than per-case below.
  const REPORTER_ALLOWED_TYPES = ['login', 'mis_row', 'issue_new', 'issue_update', 'project_add_activity'];
  if (user.role === 'reporter' && !REPORTER_ALLOWED_TYPES.includes(type)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    switch (type) {
      case 'login': {
        await logActivity({
          actor, actor_role: user.role, action: 'login',
          entity_type: 'session', entity_id: user.email, project_id: null,
        });
        return Response.json({ ok: true });
      }

      case 'user_upsert': {
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
        const { email, name, role } = data;
        if (!email || !role) return Response.json({ error: 'email and role required' }, { status: 400 });
        const result = await upsertUserRole({ email, name, role });
        await logActivity({
          actor, actor_role: user.role, action: 'user_role_set',
          entity_type: 'user', entity_id: result.email, project_id: null,
          detail: { role },
        });
        return Response.json({ ok: true, user: result });
      }

      case 'user_remove': {
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
        const { email } = data;
        if (!email) return Response.json({ error: 'email required' }, { status: 400 });
        const removed = await deleteUserRole(email);
        await logActivity({
          actor, actor_role: user.role, action: 'user_role_removed',
          entity_type: 'user', entity_id: email, project_id: null,
          detail: { role: removed?.role ?? null, name: removed?.name ?? null },
        });
        return Response.json({ ok: true });
      }

      case 'mis_row': {
        // reported_by is a data field pre-filled from login but editable client-side
        // (e.g. a shared phone) — honor it if sent, fall back to session identity.
        const result = await insertMisRow({ ...data, reported_by: data.reported_by || actor });
        await logActivity({
          actor, actor_role: user.role, action: 'mis_row_saved',
          entity_type: 'mis_row', entity_id: result.id, project_id: data.project_id,
          detail: { date: data.date, package: data.package, hr_total: result.hr_total },
        });
        return Response.json({ ok: true, row: result });
      }

      case 'issue_new': {
        if (!data.id) data.id = await nextIssueId(data.project_id);
        const reportedBy = data.reported_by || actor;
        const result = await insertIssue({ ...data, reported_by: reportedBy });
        if (data.raw_text || data.source === 'form') {
          await insertSighting({
            issue_id:       data.id,
            source:         data.source ?? 'form',
            date:           data.raised_date,
            raw_text:       data.raw_text,
            implied_status: 'Pending',
            photo_in_group: data.photo_in_group,
            reported_by:    reportedBy,
          });
        }
        await logActivity({
          actor, actor_role: user.role, action: 'issue_created',
          entity_type: 'issue', entity_id: data.id, project_id: data.project_id,
          detail: { description: data.description },
        });
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
          reported_by:    data.reported_by || actor,
        });
        await logActivity({
          actor, actor_role: user.role, action: 'issue_updated',
          entity_type: 'issue', entity_id: id, project_id: result?.project_id,
          detail: { stage: patch.stage },
        });
        return Response.json({ ok: true, issue: result });
      }

      case 'sighting': {
        const result = await insertSighting({ ...data, reported_by: data.reported_by || actor });
        await logActivity({
          actor, actor_role: user.role, action: 'sighting_added',
          entity_type: 'sighting', entity_id: result.id, project_id: null,
          detail: { issue_id: data.issue_id },
        });
        return Response.json({ ok: true, sighting: result });
      }

      case 'project_new': {
        const result = await createProject(data);
        await logActivity({
          actor, actor_role: user.role, action: 'project_created',
          entity_type: 'project', entity_id: result.id, project_id: result.id,
          detail: { name: result.name },
        });
        return Response.json({ ok: true, project: result });
      }

      case 'project_delete': {
        const { id } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        await deleteProject(id);
        await logActivity({
          actor, actor_role: user.role, action: 'project_deleted',
          entity_type: 'project', entity_id: id, project_id: null,
          detail: { id },
        });
        return Response.json({ ok: true });
      }

      case 'project_edit': {
        const { id, ...patch } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await updateProject(id, patch);
        if (!result) return Response.json({ error: 'Project not found' }, { status: 404 });
        await logActivity({
          actor, actor_role: user.role, action: 'project_edited',
          entity_type: 'project', entity_id: id, project_id: id,
          detail: { fields: Object.keys(patch) },
        });
        return Response.json({ ok: true, project: result });
      }

      case 'project_add_activity': {
        const { project_id, activity } = data;
        if (!project_id || !activity) {
          return Response.json({ error: 'project_id and activity required' }, { status: 400 });
        }
        const result = await addProjectActivity(project_id, activity);
        await logActivity({
          actor, actor_role: user.role, action: 'activity_type_added',
          entity_type: 'project', entity_id: project_id, project_id,
          detail: { activity },
        });
        return Response.json({ ok: true, activity_types: result?.activity_types ?? [] });
      }

      case 'project_add_zone': {
        const { project_id, zone } = data;
        if (!project_id || !zone) {
          return Response.json({ error: 'project_id and zone required' }, { status: 400 });
        }
        const result = await addProjectZone(project_id, zone);
        await logActivity({
          actor, actor_role: user.role, action: 'zone_added',
          entity_type: 'project', entity_id: project_id, project_id,
          detail: { zone },
        });
        return Response.json({ ok: true, towers: result?.towers ?? [] });
      }

      case 'mis_update': {
        const { id, ...patch } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        // patch.reported_by here is the curator correcting the record's own
        // reporter field — leave it as sent. `actor` (below) is who performed
        // this edit, a separate concern, and only goes into the activity log.
        const result = await updateMisRow(id, patch);
        if (!result) return Response.json({ error: 'Row not found' }, { status: 404 });
        await logActivity({
          actor, actor_role: user.role, action: 'mis_row_edited',
          entity_type: 'mis_row', entity_id: id, project_id: result.project_id,
          detail: { fields: Object.keys(patch) },
        });
        return Response.json({ ok: true, row: result });
      }

      case 'issue_patch': {
        const { id, reported_by, ...patch } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await patchIssue(id, patch);
        if (!result) return Response.json({ error: 'Issue not found' }, { status: 404 });
        // Curator edits must leave a trail on the issue timeline too, same as reporter updates do.
        const stageLabel = patch.stage === 'resolved' ? 'Resolved' : patch.stage === 'updated' ? 'Updated' : 'Raised';
        await insertSighting({
          issue_id:       id,
          source:         'curator',
          date:           new Date().toISOString().slice(0, 10),
          raw_text:       patch.note || `Curator update — ${stageLabel}`,
          implied_status: patch.stage === 'resolved' ? 'Actioned' : 'Pending',
          photo_in_group: false,
          reported_by:    reported_by || actor,
        });
        await logActivity({
          actor, actor_role: user.role, action: 'issue_patched',
          entity_type: 'issue', entity_id: id, project_id: result.project_id,
          detail: { fields: Object.keys(patch) },
        });
        return Response.json({ ok: true, issue: result });
      }

      case 'contacts_replace': {
        const { project_id, contacts } = data;
        if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });
        const result = await replaceContacts(project_id, contacts ?? []);
        await logActivity({
          actor, actor_role: user.role, action: 'contacts_replaced',
          entity_type: 'project', entity_id: project_id, project_id,
          detail: { count: (contacts ?? []).length },
        });
        return Response.json({ ok: true, contacts: result });
      }

      case 'mis_verify': {
        const { id, flag } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await markMisVerified(id, actor, flag ?? null);
        if (!result) return Response.json({ error: 'Row not found' }, { status: 404 });
        await logActivity({
          actor, actor_role: user.role, action: 'mis_verified',
          entity_type: 'mis_row', entity_id: id, project_id: result.project_id,
          detail: { flag: flag ?? null },
        });
        return Response.json({ ok: true, row: result });
      }

      case 'issue_verify': {
        const { id, flag } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await markIssueVerified(id, actor, flag ?? null);
        if (!result) return Response.json({ error: 'Issue not found' }, { status: 404 });
        await logActivity({
          actor, actor_role: user.role, action: 'issue_verified',
          entity_type: 'issue', entity_id: id, project_id: result.project_id,
          detail: { flag: flag ?? null },
        });
        return Response.json({ ok: true, issue: result });
      }

      case 'issue_unverify': {
        const { id } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await markIssueUnverified(id);
        if (!result) return Response.json({ error: 'Issue not found' }, { status: 404 });
        await logActivity({
          actor, actor_role: user.role, action: 'issue_unverified',
          entity_type: 'issue', entity_id: id, project_id: result.project_id,
        });
        return Response.json({ ok: true, issue: result });
      }

      case 'mis_unverify': {
        const { id } = data;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const result = await markMisUnverified(id);
        if (!result) return Response.json({ error: 'Row not found' }, { status: 404 });
        await logActivity({
          actor, actor_role: user.role, action: 'mis_unverified',
          entity_type: 'mis_row', entity_id: id, project_id: result.project_id,
        });
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
