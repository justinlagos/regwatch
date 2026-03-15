# RegWatch v2 — Final Implementation Plan

## 1. Locked Product Brief

**Product name:** RegWatch v2 — Compliance Operations Console

**Purpose:** RegWatch helps a compliance operator detect relevant regulatory change, understand whether it matters, link it to internal policies and procedures, trigger the next action, and preserve evidence.

**Product metaphor:** Air traffic control + case desk.

**Primary user:** Information Security & Data Protection Officer (single operator, desktop-first).

**What it replaces:**
- Manual AI search for regulatory changes
- Google research to validate findings
- Email drafting to HODs
- Policy review tracking in spreadsheets
- Evidence logging done mentally or manually
- Monthly reporting compiled from scratch

**Design philosophy:**
- Calm, serious, minimal interface
- Strong typography, neutral colours, generous whitespace
- Red only for critical alerts
- Not a news feed. Not a startup dashboard. Not a generic admin UI.
- Every screen scannable in under 5 seconds

**Core workflow:**
```
Signal arrives
  → Watchlist/control keyword match
    → Operator triages
      → Impact decision
        → Case created (operator-confirmed only)
          → Stakeholder communication drafted
            → Action tracked to closure
              → Evidence logged automatically
                → Monthly report generated
```

**Product guardrails:**
- Generic news hidden by default
- Email alerting only (no Slack in v2)
- One primary operator flow
- Every important action must leave evidence
- No fake buttons or placeholder features

---

## 2. Canonical Data Decisions

These rules prevent model confusion and code duplication.

| Entity | Decision | Rationale |
|--------|----------|-----------|
| `items` table | **Keep as DB table.** Called "Signals" in all UI copy. Frontend uses `Signal` type alias mapping to `Item` row. | Avoids migration risk on 790-row table |
| `internal_controls` table | **Extend with ALTER TABLE** to add: `type`, `owner_name`, `owner_email`, `review_cycle`, `last_reviewed_at`, `next_review_at`, `status`, `departments`. Called "Controls Register" in UI. Do NOT create a parallel `controls_register` table. | Already has 8 rows + `control_mappings` FK. Extending avoids duplication. |
| `control_mappings` table | **Keep.** Rename in UI to "Signal-Control Links." Used alongside new `signal_matches` for auto-matching. | Already wired to `internal_controls` and `items` |
| `decisions` table | **Deprecate.** 0 rows. All triage decisions go through `item_reviews`. Cases go through `cases` table. Do not write to `decisions` in v2. | Empty, superseded by triage + cases flow |
| `item_reviews` table | **Keep as triage record.** This is where signal-level triage decisions live. | 4 rows, actively used in review flow |
| `events` table | **Keep as raw system log.** 1705 rows. Not user-facing. Feeds background analytics. | Low-level operational log |
| `audit_log` table | **Keep.** 791 rows. Continue writing to it from existing mechanics. | Already working |
| `evidence_records` table | **New. Curated audit-visible ledger only.** Not a copy of `events`. Only logs meaningful operator checkpoints (see Automation Restraint below). | Clean audit view for compliance |
| `item_comments` table | **Keep for signal-level comments.** Case-level notes use new `case_notes` table. | Different scopes: signal vs case |

### Naming Rule for Code

- Database: `items`, `internal_controls`, `control_mappings`
- UI copy: "Signals", "Controls Register", "Signal-Control Links"
- TypeScript: Create `types/domain.ts` with `export type Signal = Item` alias
- Component props: use `signal` not `item` in v2 components

---

## 3. Canonical Lifecycle Rules

### Signal Lifecycle
```
new → matched → triaged → case_created → closed → ignored
```
Maps to `items.state` enum. Extend existing enum if needed:
- `detected` = new
- `classified` = matched (post-classification + keyword match)
- `reviewed` = triaged
- `closed` = closed

### Case Lifecycle
```
drafted → assigned → waiting_for_input → in_review → closed
```

### Control Lifecycle
```
active → due_soon → overdue → archived
```
`due_soon` = next_review_at within 30 days. `overdue` = next_review_at in the past.

### Drafted Action Lifecycle
```
draft → ready → sent → archived
```

### Report Lifecycle
```
draft → open → finalised
```
`open` = currently accumulating data. `finalised` = locked for export.

---

## 4. Operator Ergonomics

Since this is a personal tool for one operator:

- **Remember last-used control** when mapping signals — pre-select it in dropdowns
- **Stakeholder autocomplete** from previously entered stakeholders in `case_stakeholders`
- **Current month default** for reporting period selection
- **Prefill sender details** in email drafts from workspace settings
- **Keyboard-friendly triage** — support Enter to confirm, Escape to dismiss, arrow keys to navigate queue
- **Default filters remembered** per page via URL params (no localStorage)

---

## 5. Source Discipline

### Source Priority Order
1. Official regulator / standards body (e.g. ICO, FCA, NIST)
2. Official enforcement source (e.g. ICO enforcement actions)
3. Official threat advisory source (e.g. NCSC, CISA)
4. Reputable analysis source (e.g. Palo Alto Unit 42)
5. Generic news — **disabled by default**

### Source Rules
- Every source MUST have a `source_type` (already enforced by enum: regulatory, standards, threat)
- Add `enforcement` and `news` to `source_type` enum
- No new source enters `active` state without type classification
- Radar page shows source type prominently
- Generic news sources hidden from default signal view unless explicitly enabled

---

## 6. Automation Restraint

These rules prevent over-automation in v2:

- **No automatic case creation.** Cases are only created when the operator clicks "Create Case" in Triage. Signals can be auto-matched and auto-scored, but the operator decides what becomes a case.
- **No automatic escalation.** Escalation is operator-confirmed.
- **Evidence created only at major workflow checkpoints:**
  - signal_triaged
  - control_linked
  - case_created
  - case_status_changed
  - stakeholder_draft_created
  - stakeholder_draft_sent
  - report_generated
  - report_exported
  - case_closed
- **No auto-generated reports.** Operator initiates report generation.
- **Match suggestions are suggestions only.** Shown in Triage but not auto-acted on.

---

## 7. Signal Matching Logic

### Three Match Tiers

| Tier | Definition | UI Treatment |
|------|-----------|-------------|
| **Direct Match** | Exact watchlist term or control keyword found in signal title or body | Visible badge + listed in triage |
| **Context Match** | Partial or related phrase match (e.g. "data retention" matches "retention period") | Subtle suggestion in triage panel |
| **Weak Match** | Low-confidence mention, tangential keyword overlap | Hidden unless expanded in detail view |

### Scoring
- Direct match: score 80-100
- Context match: score 50-79
- Weak match: score 1-49

### UI Behaviour
- Radar: Direct matches show badge. Context/Weak hidden.
- Triage: Direct + Context shown. Weak available on expand.
- Command: Only Direct matches count toward "Policy Pressure" panel.

---

## 8. Final Page Map

### Current v1 → v2 Mapping

| v1 Page | v2 Page | What Happens |
|---------|---------|-------------|
| `/` (Dashboard) | `/command` | Rebuilt as operational command centre |
| `/items` | `/radar` | Renamed + redesigned as signal intake queue |
| `/items/[id]` | `/radar/[id]` | Signal detail page |
| `/review` | `/triage` | Review queue becomes full triage workspace |
| `/compliance` | `/controls` | Rebuilt as policy/procedure register |
| `/settings` | `/settings` | Expanded with Sources, Watchlists, Controls tabs |
| — (new) | `/cases` | New: action tracking after triage |
| — (new) | `/cases/[id]` | New: case detail |
| — (new) | `/reports` | New: monthly reporting workspace |
| — (new) | `/evidence` | New: audit evidence ledger |

### v2 Route Structure

```
/command          → Command page (home, default route)
/radar            → Signal monitoring + source health
/radar/[id]       → Signal detail
/triage           → Triage workspace
/cases            → Cases list
/cases/[id]       → Case detail
/controls         → Controls register
/controls/[id]    → Control detail
/reports          → Report templates + builder
/evidence         → Evidence ledger
/settings         → Sources / Watchlists / Controls / Notifications / Workspace
```

### Navigation Bar

```
[RegWatch]  Command  Radar  Triage  Cases  Controls  Reports  Evidence  [⚙]
```

---

## 9. Migration Plan

### Strategy: Extend existing tables, add new ones, no parallel models.

#### Migration 1: `v2_extend_source_types`

```sql
-- Add enforcement and news to source_type enum
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'enforcement';
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'news';
```

#### Migration 2: `v2_extend_internal_controls`

```sql
-- Extend internal_controls to become full Controls Register
-- (no new table — extend existing)
ALTER TABLE internal_controls
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'policy'
    CHECK (type IN ('policy', 'procedure', 'control_process', 'reporting_obligation')),
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS review_cycle text DEFAULT '12 months',
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'due_soon', 'overdue', 'archived')),
  ADD COLUMN IF NOT EXISTS departments text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
```

#### Migration 3: `v2_watchlists`

```sql
CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.watchlist_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  term text NOT NULL,
  match_type text NOT NULL DEFAULT 'broad'
    CHECK (match_type IN ('exact', 'broad', 'phrase')),
  sensitivity text NOT NULL DEFAULT 'medium'
    CHECK (sensitivity IN ('low', 'medium', 'high')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_watchlist_terms_watchlist ON watchlist_terms(watchlist_id);
CREATE INDEX idx_watchlists_workspace ON watchlists(workspace_id);
```

#### Migration 4: `v2_control_keywords_regulations`

```sql
CREATE TABLE public.control_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id uuid NOT NULL REFERENCES internal_controls(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.control_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id uuid NOT NULL REFERENCES internal_controls(id) ON DELETE CASCADE,
  regulation_name text NOT NULL,
  regulation_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_control_keywords_control ON control_keywords(control_id);
CREATE INDEX idx_control_regulations_control ON control_regulations(control_id);
```

#### Migration 5: `v2_signal_matches`

```sql
CREATE TABLE public.signal_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  watchlist_id uuid REFERENCES watchlists(id) ON DELETE SET NULL,
  control_id uuid REFERENCES internal_controls(id) ON DELETE SET NULL,
  match_tier text NOT NULL DEFAULT 'direct'
    CHECK (match_tier IN ('direct', 'context', 'weak')),
  match_reason text NOT NULL,
  match_score integer NOT NULL DEFAULT 50
    CHECK (match_score >= 0 AND match_score <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signal_matches_signal ON signal_matches(signal_id);
CREATE INDEX idx_signal_matches_watchlist ON signal_matches(watchlist_id);
CREATE INDEX idx_signal_matches_control ON signal_matches(control_id);
CREATE INDEX idx_signal_matches_tier ON signal_matches(match_tier);
```

#### Migration 6: `v2_cases`

```sql
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  signal_id uuid REFERENCES items(id) ON DELETE SET NULL,
  control_id uuid REFERENCES internal_controls(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  owner_name text,
  owner_email text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'drafted'
    CHECK (status IN ('drafted', 'assigned', 'waiting_for_input', 'in_review', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE public.case_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  department text,
  role text DEFAULT 'stakeholder',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'operator',
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_workspace ON cases(workspace_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_case_stakeholders_case ON case_stakeholders(case_id);
CREATE INDEX idx_case_notes_case ON case_notes(case_id);
```

#### Migration 7: `v2_drafted_actions`

```sql
CREATE TABLE public.drafted_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'hod_email'
    CHECK (type IN ('hod_email', 'internal_summary', 'escalation_note', 'report_note')),
  subject text,
  body text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'sent', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drafted_actions_case ON drafted_actions(case_id);
```

#### Migration 8: `v2_reporting`

```sql
CREATE TABLE public.reporting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'finalised')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  reporting_period_id uuid REFERENCES reporting_periods(id) ON DELETE SET NULL,
  report_type text NOT NULL
    CHECK (report_type IN ('monthly_monitoring', 'infosec_metrics_support', 'executive_summary', 'audit_snapshot')),
  title text NOT NULL,
  config_json jsonb DEFAULT '{}',
  output_json jsonb DEFAULT '{}',
  created_by text DEFAULT 'operator',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reporting_periods_workspace ON reporting_periods(workspace_id);
CREATE INDEX idx_generated_reports_workspace ON generated_reports(workspace_id);
```

#### Migration 9: `v2_evidence`

```sql
CREATE TABLE public.evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action_type text NOT NULL
    CHECK (action_type IN (
      'signal_triaged', 'control_linked', 'case_created',
      'case_status_changed', 'stakeholder_draft_created',
      'stakeholder_draft_sent', 'report_generated',
      'report_exported', 'case_closed'
    )),
  actor text DEFAULT 'operator',
  metadata_json jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_workspace ON evidence_records(workspace_id);
CREATE INDEX idx_evidence_entity ON evidence_records(entity_type, entity_id);
CREATE INDEX idx_evidence_created ON evidence_records(created_at DESC);
CREATE INDEX idx_evidence_action ON evidence_records(action_type);
```

#### Migration 10: `v2_seed_data`

Seed data is injected via app-level script after confirming workspace exists. NOT hardcoded in migration SQL.

The app seed endpoint (`/api/seed-v2`) will:
1. Query for first workspace
2. Check if controls already have `type` column populated
3. Update existing 8 `internal_controls` rows with type/review_cycle/status
4. Insert 2 additional controls (Training + Monthly Reporting)
5. Insert 5 default watchlists with starter terms
6. Insert default watchlist terms (keywords per watchlist)

This avoids hardcoded UUIDs and is idempotent.

### Migration Execution Order

| # | Name | Dependencies |
|---|------|-------------|
| 1 | `v2_extend_source_types` | sources |
| 2 | `v2_extend_internal_controls` | internal_controls |
| 3 | `v2_watchlists` | workspaces |
| 4 | `v2_control_keywords_regulations` | internal_controls |
| 5 | `v2_signal_matches` | items, watchlists, internal_controls |
| 6 | `v2_cases` | workspaces, items, internal_controls |
| 7 | `v2_drafted_actions` | cases |
| 8 | `v2_reporting` | workspaces |
| 9 | `v2_evidence` | workspaces |
| 10 | `v2_seed_data` | app-level, post-migration |

---

## 10. Component Tree

### Shared/Layout

```
app/
├── layout.tsx                     ← MODIFY: new nav bar
├── types/
│   └── domain.ts                  ← NEW: Signal = Item alias + shared types
├── components/
│   ├── ui/                        ← NEW: shared primitives
│   │   ├── StatusBadge.tsx
│   │   ├── PriorityBadge.tsx
│   │   ├── DataTable.tsx
│   │   ├── Drawer.tsx
│   │   ├── EmptyState.tsx
│   │   ├── SectionHeader.tsx
│   │   └── StatsCard.tsx
│   ├── ConfidenceBadge.tsx        ← KEEP
│   ├── AIDisclaimer.tsx           ← KEEP
│   └── AuditTimeline.tsx          ← KEEP
```

### Pages

```
app/
├── command/page.tsx               StatusStrip, AttentionHero, WorkflowPipeline,
│                                  PolicyPressurePanel, ReportingReadinessCard,
│                                  PriorityCasesList
├── radar/
│   ├── page.tsx                   SourceHealthTable, SignalFiltersBar,
│   │                              SignalIntakeTable, SourceErrorPanel
│   └── [id]/page.tsx              SignalDetailView + actions
├── triage/page.tsx                TriageHeader, TriageQueueList,
│                                  TriageWorkspace, ImpactEditor,
│                                  DecisionActionsBar, CreateCaseModal
├── cases/
│   ├── page.tsx                   CaseStatsStrip, CasesTable
│   └── [id]/page.tsx              CaseDetailHeader, CaseTimeline,
│                                  StakeholderPanel, DraftEmailPanel,
│                                  CaseNotes, ClosurePanel
├── controls/
│   ├── page.tsx                   ControlsRegisterTable, ReviewTimelineWidget
│   └── [id]/page.tsx              ControlDetailHeader, RegulationMappingPanel,
│                                  KeywordMappingPanel, ReviewHistoryPanel,
│                                  LinkedSignalsList, LinkedCasesList
├── reports/page.tsx               ReportTemplateCards, ReportBuilderForm,
│                                  ReportPreviewPane, ExportActionsBar
├── evidence/page.tsx              EvidenceFilters, EvidenceLedgerTable,
│                                  EvidenceDetailPanel, ExportHistoryPanel
├── settings/page.tsx              SourcesManager, WatchlistManager,
│                                  ControlsManager, NotificationSettings,
│                                  WorkspaceSettings
```

### API Routes

```
app/api/
├── watchlists/route.ts            ← NEW
├── signal-matches/route.ts        ← NEW
├── cases/route.ts                 ← NEW
├── case-notes/route.ts            ← NEW
├── case-stakeholders/route.ts     ← NEW
├── drafted-actions/route.ts       ← NEW
├── reports/route.ts               ← NEW
├── evidence/route.ts              ← NEW
├── seed-v2/route.ts               ← NEW (idempotent seed)
├── settings/route.ts              ← KEEP + extend
├── export/route.ts                ← KEEP
├── controls/route.ts              ← KEEP (extend for register)
├── comments/route.ts              ← KEEP
├── review/route.ts                ← KEEP (triage)
├── audit/route.ts                 ← KEEP
└── override/route.ts              ← KEEP
```

---

## 11. Phased Implementation Checklist

### Phase 1: Information Architecture Refactor
**Goal:** New nav + page shells. App stays functional.

- [ ] Update `layout.tsx` — new nav: Command, Radar, Triage, Cases, Controls, Reports, Evidence, Settings ⚙
- [ ] Create `types/domain.ts` — Signal type alias
- [ ] Create `/command/page.tsx` — placeholder shell
- [ ] Create `/radar/page.tsx` — lift current `/items/page.tsx` logic
- [ ] Create `/radar/[id]/page.tsx` — lift current `/items/[id]/page.tsx`
- [ ] Create `/triage/page.tsx` — lift current `/review/page.tsx` logic
- [ ] Create `/cases/page.tsx` — empty shell
- [ ] Create `/cases/[id]/page.tsx` — empty shell
- [ ] Create `/controls/page.tsx` — lift current `/compliance/page.tsx`
- [ ] Create `/controls/[id]/page.tsx` — empty shell
- [ ] Create `/reports/page.tsx` — empty shell
- [ ] Create `/evidence/page.tsx` — empty shell
- [ ] Add redirects: `/` → `/command`, keep `/items` and `/review` working
- [ ] **Verify:** All 8 pages accessible via nav, no broken routes

**Files:** ~13 new/modified | **DB:** None

### Phase 2: Design System Refinement
**Goal:** Consistent, calm visual language.

- [ ] Create 7 shared UI components in `components/ui/`
- [ ] Update colour palette: slate/zinc neutrals, red-600 only for critical
- [ ] Standardise typography hierarchy
- [ ] Apply to Radar + Triage pages first
- [ ] Remove gradient-heavy or card-cluttered patterns
- [ ] **Verify:** Consistent feel across all pages

**Files:** ~7 new + style updates | **DB:** None

### Phase 3: Database Expansion
**Goal:** All new tables + extended controls in Supabase.

- [ ] Migration 1: extend source_type enum
- [ ] Migration 2: extend internal_controls (type, owner, review cycle, status)
- [ ] Migration 3: watchlists + watchlist_terms
- [ ] Migration 4: control_keywords + control_regulations
- [ ] Migration 5: signal_matches (with match_tier)
- [ ] Migration 6: cases + case_stakeholders + case_notes
- [ ] Migration 7: drafted_actions
- [ ] Migration 8: reporting_periods + generated_reports
- [ ] Migration 9: evidence_records (constrained action_types)
- [ ] Seed endpoint: `/api/seed-v2` (idempotent, workspace-aware)
- [ ] **Verify:** All tables exist, seed data present, existing data intact

**Files:** 1 API route | **DB:** 9 migrations + seed

### Phase 4: Watchlists
**Goal:** User-defined keyword tracking.

- [ ] Build `/api/watchlists/route.ts` — CRUD watchlists + terms
- [ ] Build WatchlistManager tab in Settings
- [ ] Build matching logic (title/body against terms)
- [ ] Show watchlist hit badges on signals in Radar
- [ ] Add watchlist filter in signal filters
- [ ] **Verify:** Create watchlist → existing signals show matches

**Files:** ~4 | **DB:** None

### Phase 5: Controls Register
**Goal:** Internal policy/procedure library.

- [ ] Extend `/api/controls/route.ts` for register fields
- [ ] Build ControlsRegisterTable with type/owner/review columns
- [ ] Build control detail page with keyword + regulation panels
- [ ] Build ControlsManager tab in Settings
- [ ] Compute due_soon/overdue from next_review_at
- [ ] Update existing 8 controls with type and review data via seed
- [ ] **Verify:** Controls page shows register with status indicators

**Files:** ~5 | **DB:** None

### Phase 6: Signal-to-Control Matching
**Goal:** Auto-suggest which control a signal affects.

- [ ] Build `/api/signal-matches/route.ts`
- [ ] Matching engine: watchlist terms + control keywords → match_tier + score
- [ ] Run on new signals post-classification (edge function hook or API)
- [ ] Show Direct matches as badges in Radar
- [ ] Show Direct + Context matches in Triage workspace
- [ ] **Verify:** New signals show probable affected controls with reasons

**Files:** ~3 + edge function | **DB:** None

### Phase 7: Triage Workspace
**Goal:** Full decision-making interface.

- [ ] TriageHeader with queue stats
- [ ] TriageQueueList (stacked rows, not cards)
- [ ] TriageWorkspace panel (summary, matches, suggested action)
- [ ] ImpactEditor (editable severity/confidence/notes)
- [ ] DecisionActionsBar (no impact / monitor / review / escalate)
- [ ] CreateCaseModal (operator-confirmed only)
- [ ] Write evidence_record on each triage decision
- [ ] **Verify:** Signal → triage → decision → optional case creation

**Files:** ~6 | **DB:** None

### Phase 8: Cases System
**Goal:** Track work after triage.

- [ ] Build `/api/cases/route.ts` — CRUD
- [ ] CaseStatsStrip + CasesTable
- [ ] Case detail page with CaseTimeline, StakeholderPanel, CaseNotes
- [ ] ClosurePanel with outcome
- [ ] Stakeholder autocomplete from previous entries
- [ ] Write evidence_record on case creation/status change/closure
- [ ] **Verify:** Create case from triage → manage → close

**Files:** ~8 | **DB:** None

### Phase 9: Action Drafting
**Goal:** One-click stakeholder communication.

- [ ] Build `/api/drafted-actions/route.ts`
- [ ] DraftEmailPanel: HOD email template (what changed, why, who, deadline)
- [ ] Internal summary generator (3-bullet: issue / implication / action)
- [ ] Escalation note generator
- [ ] Prefill sender from workspace settings
- [ ] Edit before marking ready/sent
- [ ] Write evidence_record on draft_created and draft_sent
- [ ] **Verify:** Draft email from case → edit → mark sent

**Files:** ~3 | **DB:** None

### Phase 10: Reporting
**Goal:** Monthly monitoring output.

- [ ] Build `/api/reports/route.ts`
- [ ] 4 preset templates (not a flexible builder):
  - Monthly Monitoring Summary
  - GTCO Metrics Support Pack
  - Executive Snapshot
  - Audit Evidence Summary
- [ ] Light filters: date range, source scope, control areas
- [ ] ReportPreviewPane from live data
- [ ] Export: PDF + CSV
- [ ] Default to current month period
- [ ] Write evidence_record on report_generated and report_exported
- [ ] **Verify:** Generate monthly summary → preview → export

**Files:** ~5 | **DB:** None

### Phase 11: Evidence Layer
**Goal:** Automatic audit trail.

- [ ] Build `/api/evidence/route.ts`
- [ ] EvidenceFilters + EvidenceLedgerTable
- [ ] EvidenceDetailPanel (original signal, decision, case, actions)
- [ ] ExportHistoryPanel
- [ ] Verify all 9 checkpoint types write evidence correctly
- [ ] **Verify:** Every triage/case/report action visible in evidence ledger

**Files:** ~4 | **DB:** None

### Phase 12: Command Page + Cleanup
**Goal:** Build Command page with live data. Polish everything.

- [ ] StatusStrip: source health, last ingestion, failed count, active watchlists
- [ ] AttentionHero: critical cases, watchlist hits, overdue, low-confidence
- [ ] WorkflowPipeline: Detected → Triaged → Review → Awaiting → Closed
- [ ] PolicyPressurePanel: controls with Direct matches this week
- [ ] ReportingReadinessCard: current month status
- [ ] PriorityCasesList: top 5 open cases
- [ ] Remove old v1 routes (/items → redirect to /radar, etc.)
- [ ] Test empty states, loading states, error states
- [ ] Desktop responsiveness check
- [ ] Tighten copy and labels
- [ ] Remove dead buttons
- [ ] **Verify:** Complete walkthrough of full operator workflow

**Files:** Various | **DB:** Optional demo data

---

## 12. Phase Delivery Protocol

At the **start** of each phase:
1. What files will change
2. What DB changes are needed
3. What the operator will see after

At the **end** of each phase:
1. What was completed
2. What still remains
3. What must be tested manually

**Do not redesign architecture mid-build. The strategy is set.**

---

## 13. Success Definition

A successful RegWatch v2 session:

```
Open Command → See 3 relevant changes
→ One tagged to Data Retention Policy (direct match)
→ Click through to Triage
→ Review match rationale
→ Create Case
→ Generate HOD email
→ Mark policy review required
→ Close case when resolved
→ Include in monthly report
→ Evidence automatically logged throughout
```

All from one interface. Under 10 minutes.

---

## 14. Single Workspace, Single Operator Rule

For v2, optimise screens and defaults for one primary operator in one workspace. Do not introduce complex team workflows. Multi-user features limited to:
- Case assignment (owner_name field)
- Stakeholder tracking (for external HODs)
- Author attribution on notes

No role-based access control, no team dashboards, no permission layers in v2.
