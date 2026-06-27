// Centralised thresholds — change here, applies everywhere.
// !! READ THIS FILE BEFORE TOUCHING ANY ENUM OR THRESHOLD !!

export const REPORT_WARN_DAYS = 3;    // days since last MIS → amber freshness
export const REPORT_STOP_DAYS = 7;    // days since last MIS → red freshness
export const TOAST_MS         = 3000; // success toast auto-dismiss
export const AUTH_KEY         = 'abja_auth';
export const CURATOR_KEY      = 'abja_curator_name';
export const HIST_SOURCE      = 'steward'; // MIS source tag for historical seeded data

// ── Issue stage enum ─────────────────────────────────────────────────────────
// AUTHORITATIVE list — must match what is stored in issues.stage column.
// Any UI showing stages (buttons, selects, badges) MUST derive from this.
export const ISSUE_STAGES = [
  { value: 'raised',             label: 'Raised' },
  { value: 'with_abja',          label: 'With ABJA' },
  { value: 'escalated_supplier', label: 'Escalated — Supplier' },
  { value: 'awaiting_client',    label: 'Awaiting Client' },
  { value: 'resolved',           label: 'Resolved' },
];

// Subset shown to field reporters — they close via "close issue" mode, not by setting resolved.
export const REPORTER_STAGES = ISSUE_STAGES.slice(0, 4);

// ── Issue owner_type enum ────────────────────────────────────────────────────
// AUTHORITATIVE list — must match what is stored in issues.owner_type column.
export const ISSUE_OWNER_TYPES = [
  { value: 'int', label: 'Internal' },
  { value: 'ext', label: 'External' },
  { value: 'com', label: 'Compliance' },
];

// Colour per stage value — used by CuratorsPanel quick-buttons and any badge.
export const STAGE_COLORS = {
  raised:             'var(--stop)',
  with_abja:          'var(--blue2)',
  escalated_supplier: 'var(--orange)',
  awaiting_client:    'var(--warn)',
  resolved:           'var(--go)',
};
