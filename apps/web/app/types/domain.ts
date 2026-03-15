// Domain type aliases — DB uses `items`, UI uses `Signals`
// This file ensures consistent naming across the v2 codebase.

export type Signal = {
  id: string
  workspace_id: string
  source_id: string
  ingestion_run_id: string | null
  canonical_url: string
  content_hash: string
  title: string | null
  published_at: string | null
  raw_payload: any
  extracted_text: string | null
  state: string
  detected_at: string
  classified_at: string | null
  reviewed_at: string | null
  closed_at: string | null
}

export type SignalClassification = {
  id: string
  item_id: string
  impact_level: '1' | '2' | '3' | '4'
  confidence_score: number
  summary: string | null
  recommended_action: string | null
  iso_clauses: { code: string; name: string }[]
  nist_controls: { code: string; name: string }[]
  override_level: string | null
}

export type Control = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  framework: string
  ref: string | null
  type: 'policy' | 'procedure' | 'control_process' | 'reporting_obligation'
  owner_name: string | null
  owner_email: string | null
  review_cycle: string
  last_reviewed_at: string | null
  next_review_at: string | null
  status: 'active' | 'due_soon' | 'overdue' | 'archived'
  departments: string[]
}

export type Case = {
  id: string
  workspace_id: string
  signal_id: string | null
  control_id: string | null
  title: string
  summary: string | null
  owner_name: string | null
  owner_email: string | null
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'drafted' | 'assigned' | 'waiting_for_input' | 'in_review' | 'closed'
  created_at: string
  updated_at: string
  closed_at: string | null
}

export type DraftedAction = {
  id: string
  case_id: string
  type: 'hod_email' | 'internal_summary' | 'escalation_note' | 'report_note'
  subject: string | null
  body: string | null
  status: 'draft' | 'ready' | 'sent' | 'archived'
}

export type EvidenceRecord = {
  id: string
  workspace_id: string
  entity_type: string
  entity_id: string
  action_type: string
  actor: string
  metadata_json: any
  created_at: string
}

export const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'
