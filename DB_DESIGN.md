# DB Design — Field Origins & Decisions

## Where every field comes from

### `projects` table

| Field | Source | Why |
|---|---|---|
| `id` | You define it ("APAS", "SAYUK", "VPNA") | Short code used everywhere — issue IDs, mis_rows FK, URL param |
| `name` | `D.projects[].name` in app.js | "My Home APAS" — display name in dashboard header |
| `discipline` | `D.projects[].discipline` | "Fire-Fighting", "Electrical" — shown in scorecard row |
| `lead` | `D.projects[].lead` | Lead coordinator name — shown in detail header |
| `id_prefix` | `PROJECTS[].idp` in data-projects.js | "APA", "SAY" — generates issue IDs like APA-18 |
| `towers` | `PROJECTS[].towers` (was count, now names) | Array of ["Tower 1","Tower 2","Podium",...] — populates form dropdown. Changed from integer count because some towers are non-numeric (Podium, B1, B2) |
| `work_packages` | `PROJECTS[].pkgs` | ["Prudvi Industries","ABJA direct"] — contractor dropdown in MIS form |
| `activity_types` | `PROJECTS[].act` | ["cable laying","welding",...] — activity dropdown in MIS form |
| `working_days` | `D.projects[].workingDays` | **Was missing from v1 schema.** Needed for coverage % = reported_days / working_days. Currently hardcoded (APAS=132). Must be stored. |
| `status` | New field | active / completed — to filter portfolio view |
| `start_date`, `end_date` | `dt.period` in DETAIL | Project timeline — shown in detail header |

### `mis_rows` table

| Field | Source | Why |
|---|---|---|
| `project_id` | Form dropdown / chat | Which project this daily report belongs to |
| `date` | `mDate` in field entry form | The reporting date (not submission date) |
| `package` | `mPkg` dropdown | Which contractor/work-package submitted this (one mis_row per package per day) |
| `manpower_total` | `updTotal()` in field-entry.js | The `TOTAL = N` line in MIS message. Dashboard shows avg crew, peak crew |
| `manpower_detail` | `crew{}` object | {Engineer:1, Supervisor:1, Fitter:6, Helper:3} — breakdown if needed |
| `activities` | `acts[]` array | [{tower:"Tower 2", area:"14th flr", activity:"welding"}] — feeds activity mix chart and tower breakdown chart |
| `reported_by` | `who` field in form | Displayed in the WhatsApp message; stored for audit |
| `source` | Set by system | form / steward / chat — trust calibration; form entries are structured, chat-parsed entries are estimated |

**Dashboard derives from mis_rows:**
- `reportedDays` → COUNT(DISTINCT date) per project
- `coverage%` → reportedDays / working_days × 100
- `totalManDays` → SUM(manpower_total)
- `avgCrew` → AVG(manpower_total)
- `peakCrew` → MAX(manpower_total)
- `estMD` → totalManDays ÷ (coverage / 100) — computed, not stored
- Monthly trend chart → GROUP BY month
- Activity mix chart → unnest activities JSONB, group by activity
- Tower scope chart → unnest activities JSONB, group by tower

### `issues` table

| Field | Source | Why |
|---|---|---|
| `id` | Generated (APA-18) | Ref shown in dashboard blocker register table |
| `project_id` | Form / steward | Which project |
| `description` | `bWhat` in field entry form / steward curation | The issue text — shown in blocker table |
| `owner` | `bOwner` field | Person/party accountable — shown in "Owner" column |
| `owner_type` | `btype` (int/ext/com) | Int=Internal, Ext=External, Com=Compliance — drives ownerSplit KPI and colour coding |
| `stage` | `status` in blockers (Pending/Actioned/Dated) mapped to stages | Drives statusSplit KPI (pending/actioned/dated counts) |
| `waiting_on` | `bTower` + `bFloor` + free text | What/who the blocker is waiting on — free text field |
| `needed_by` | `bNeed` date | Deadline — shown in blocker form |
| `photo_in_group` | `photoB` toggle | Whether proof photo was posted — evidence density signal |
| `recur` | Computed / steward flags | ↻ symbol in blocker table — has been re-raised |
| `raised_date` | `bDate` / message date | First date column in blocker table |
| `resolved_date` | Set on blocker_close | When stage becomes resolved |
| `note` | Steward's reconciled note | Steward's curated understanding of the issue |
| `source` | Set by system | form / steward / chat |

**Dashboard derives from issues:**
- `distinctBlockers` → COUNT(issues)
- `openBlockers` → COUNT WHERE stage != 'resolved'
- `ownerSplit` → COUNT by owner_type
- `statusSplit` (pending/actioned/dated) → COUNT by stage mapping
- `blockerMentions` → COUNT(sightings) across all issues in project

### `sightings` table

| Field | Source | Why |
|---|---|---|
| `issue_id` | FK to issues | Which blocker this sighting refers to |
| `source` | form / chat / steward / call | Provenance — form is most trusted |
| `date` | Message date / form date | When this mention occurred |
| `raw_text` | Original message text | The actual WhatsApp message — proof layer |
| `implied_status` | Steward's judgement | What this sighting suggests: Pending / Actioned / Dated |
| `photo_in_group` | Toggle / chat detection | Photo evidence posted — evidence density signal |
| `reported_by` | Sender / form field | Who mentioned it |

**Dashboard derives from sightings (via issue_age view):**
- `daysOpen` → MAX(date) - MIN(date) per issue
- `firstSighting` / `lastSighting` → MIN/MAX date
- `sighting_count` → times a blocker was raised (the "×" count in table)
- `quiet_days` → CURRENT_DATE - MAX(date) — drives inferred status (active/stale/resolved)
- `evidence density` → % of sightings with photo_in_group = true

---

## What the current app shows that we need extra tables for

### 1. `cert_events` — Certification timeline (Certification tab in detail view)

The current app shows a timeline of events like:
- "Approved shop drawings submission requested"
- "QRM #27 — quarterly review agenda"
- "PTW Hot-Work permit MHC/APA/PRUDVI/HW/0061"
- "NCR / observation closure"

These come from chat analysis by the steward. Need a table to store them.

### 2. `project_signals` — Pre-computed signals (Signals tab in detail view)

These cannot be derived from form submissions alone — they come from chat analysis:
- `resp_median_hours` — median hours for escalation query → answer
- `resp_within_4h_pct` — % of queries answered within 4h
- `resp_nextday_pct` — % next day+
- `urgency_count` — "immediate/unacceptable" keyword flags
- `evidence_pct` — % of messages that are photo-backed
- `league` — [{name, count}] who appears most in escalations

Steward runs chat analysis periodically and saves the result. One row per project per period.

### 3. `issue_dependencies` — Steward's dependency graph (what you asked about)

`waiting_on TEXT` in issues is too flat. The steward identifies structured dependencies:
- APA-10 blocked on APA-09 (issue-to-issue sequential dependency)
- SAY-02 blocked on "Civil team" (issue-to-external-party)
- Multiple issues blocked on one thing (parallel dependency)

---

## Your specific questions

### Is `lib/` separate and secure?
Yes. `lib/db.js` runs **only inside Netlify Functions** (serverless Node.js on the server). The browser never touches it. `DATABASE_URL` is an environment variable set in the Netlify dashboard — never in code, never sent to browser. The read function returns only the query results, not the connection string. To swap from Neon to any other Postgres: change the import in `db.js` only — all 3 functions stay unchanged.

### Contractor per project?
`work_packages` in `projects` is **form config** — the dropdown options for that project's MIS form. It is project-specific ("Prudvi Industries" is only on APAS; "Krish Automation" is only on SAYUK). The actual contractor name is stored in `mis_rows.package` as a string. No separate contractors table needed now — if you later want cross-project contractor analytics (same company on multiple projects), add it then.

### Tower numbering — numbers enough?
No. Changed to `towers JSONB` (array of strings). Some towers are non-numeric: APAS has "Podium Eastside", projects have "B1", "B2". The field entry form just iterates the array for the dropdown. Stored as `["Tower 1","Tower 2","Tower 3","Podium"]`.

### Where does steward's dependency graph get stored?
New `issue_dependencies` table. From issue → to issue OR to external party, with type (sequential/parallel). The `waiting_on` text field in issues stays as the steward's quick free-text note; `issue_dependencies` is the structured graph the steward builds at the approval modal.
