export interface UatProject {
  id: string;
  name: string;
  client_company: string | null;
  description: string | null;
  live_url: string | null;
  status: string;
  reference: string | null;
  objective: string | null;
  start_date: string | null;
  completion_date: string | null;
  coverage_target: string | null;
  required_testers: number | null;
  product_website: string | null;
  created_at: string;
  updated_at: string;
  environments?: UatEnvironment[];
}

export interface UatEnvironment {
  id: string;
  project_id: string;
  environment_name: string;
  type: string;
  base_url: string | null;
  login_url: string | null;
  admin_login_url: string | null;
  tester_login_url: string | null;
  current_build: string | null;
  release_candidate: string | null;
  version: string | null;
  git_branch: string | null;
  environment_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UatFeedback {
  id: string;
  project_id: string;
  job_id: string;
  tester_id: string;
  feedback_type: string;
  severity: string;
  category: string | null;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  expected_result: string | null;
  actual_result: string | null;
  page_url: string | null;
  device: string | null;
  browser: string | null;
  status: string;
  reference: string | null;
  priority: string | null;
  evidence_count: number | null;
  created_at: string;
  updated_at: string;
  project_name?: string;
  tester_name?: string;
  // ── Defect review / ticket link (Prompt 07) ──
  defect_review_status?: string | null;
  defect_reviewed_by?: string | null;
  defect_reviewed_at?: string | null;
  defect_review_note?: string | null;
  support_ticket_id?: string | null;
  test_case_result_id?: string | null;
  duplicate_of?: string | null;
}

export interface UatSession {
  id: string;
  assignment_id: string;
  tester_id: string;
  project_id: string | null;
  environment_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  device_used: string | null;
  browser_used: string | null;
  browser_name: string | null;
  browser_version: string | null;
  operating_system: string | null;
  active_seconds: number;
  pause_seconds: number;
  created_at: string;
  project_name?: string;
  tester_name?: string;
  environment_name?: string;
}

export interface UatTestCaseResult {
  id: string;
  assignment_test_case_id: string;
  assignment_id: string;
  test_case_id: string;
  session_id: string;
  tester_id: string;
  status: string;
  actual_result: string | null;
  tester_notes: string | null;
  blocker_reason: string | null;
  duration_seconds: number;
  created_at: string;
  test_case_title?: string;
  test_case_reference?: string;
  tester_name?: string;
}

export interface UatEvidence {
  id: string;
  project_id: string | null;
  feedback_id: string | null;
  session_id: string | null;
  tester_id: string | null;
  job_id: string | null;
  assignment_id: string | null;
  assignment_test_case_id: string | null;
  test_case_id: string | null;
  evidence_type: string;
  file_type: string | null;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  capture_source: string;
  caption: string | null;
  tester_notes: string | null;
  status: string;
  created_at: string;
  project_name?: string;
  tester_name?: string;
}

export interface UatApproval {
  id: string;
  project_id: string;
  status: string;
  approver_id: string | null;
  decided_at: string | null;
  evidence: string | null;
  exceptions: string | null;
  conditions: string | null;
  decision_reason: string | null;
  created_at: string;
  updated_at: string;
  project_name?: string;
}

export interface UatJob {
  id: string;
  project_id: string;
  environment_id: string | null;
  title: string;
  description: string | null;
  public_summary: string | null;
  test_instructions: string | null;
  required_devices: string[];
  required_browsers: string[];
  required_experience_level: string;
  estimated_hours: number | null;
  pay_amount: number;
  pay_type: string;
  max_testers: number;
  deadline: string | null;
  status: string;
  reference: string | null;
  reserve_count: number | null;
  application_opens_at: string | null;
  application_closes_at: string | null;
  evidence_requirements: string | null;
  created_at: string;
  // ── Marketplace / publication fields (Prompt 01) ──
  marketplace_status: string;
  visibility: string;
  claim_mode: string;
  reward_amount_minor: number;
  currency: string;
  estimated_minutes_min: number | null;
  estimated_minutes_max: number | null;
  tester_slots_filled: number;
  minimum_tester_rating: number | null;
  evidence_requirement_tags: string[];
  published_at: string | null;
  // ── Derived join labels ──
  project_name?: string;
  environment_name?: string;
}

export interface UatTester {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  town_city: string | null;
  country: string | null;
  experience_level: string;
  status: string;
  onboarding_status: string | null;
  reliability_band: string | null;
  quality_band: string | null;
  reliability_score: number | null;
  quality_score: number | null;
  devices: string[];
  browsers: string[];
  created_at: string;
}

export interface UatAssignment {
  id: string;
  job_id: string;
  tester_id: string;
  application_id: string | null;
  status: string;
  agreed_reward_amount_minor: number;
  currency: string;
  offered_at: string | null;
  accepted_at: string | null;
  deadline: string | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  session_count: number | null;
  feedback_count: number | null;
  review_status: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_feedback: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  tester_name?: string;
  tester_email?: string;
}

export interface UatJobApplication {
  id: string;
  job_id: string;
  tester_id: string;
  status: string;
  application_message: string | null;
  created_at: string;
  updated_at: string;
  tester_name?: string;
  tester_email?: string;
  tester_experience_level?: string | null;
  decision_reason?: string | null;
  reviewed_at?: string | null;
}

export interface UatReward {
  id: string;
  assignment_id: string;
  tester_id: string;
  job_id: string;
  reward_amount_minor: number;
  currency: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  tester_name?: string;
  job_title?: string;
  assignment_status?: string;
}

export interface UatDefectTicket {
  id: string;
  ticket_number: string;
  status: string;
  subject: string;
}

/** A single FAIL/BLOCKED test-case result surfaced into the defect review queue. */
export interface UatDefectItem {
  resultId: string;
  status: string;
  actualResult: string | null;
  testerNotes: string | null;
  blockerReason: string | null;
  submittedAt: string | null;
  testCaseId: string;
  testCaseTitle: string;
  testCaseReference: string | null;
  expectedResult: string | null;
  assignmentId: string;
  jobId: string;
  projectId: string;
  testerId: string;
  testerName: string;
  jobTitle: string;
  projectName: string;
  device: string | null;
  browser: string | null;
  evidence: UatEvidence[];
  defect: UatFeedback | null;
  ticket: UatDefectTicket | null;
}

export const ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-sky-500/10 text-sky-400',
  reserved: 'bg-amber-500/10 text-amber-400',
  in_progress: 'bg-emerald-500/10 text-emerald-400',
  testing: 'bg-emerald-500/10 text-emerald-400',
  submitted: 'bg-violet-500/10 text-violet-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  expired: 'bg-foreground-500/10 text-foreground-500',
  cancelled: 'bg-foreground-500/10 text-foreground-500',
};

export const APPLICATION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  withdrawn: 'bg-foreground-500/10 text-foreground-500',
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  reserved: 'Reserved',
  in_progress: 'In Progress',
  testing: 'In Progress',
  submitted: 'Submitted',
  completed: 'Completed',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const REVIEW_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-yellow-500/10 text-yellow-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  changes_requested: 'bg-amber-500/10 text-amber-400',
  rejected: 'bg-red-500/10 text-red-400',
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  changes_requested: 'More Info Requested',
  rejected: 'Rejected',
};

export interface DashboardSummary {
  projectsActive: number;
  openBugs: number;
  testersAvailable: number;
  sessionsActive: number;
  pendingApprovals: number;
  testsPassed: number;
  testsFailed: number;
  readyForDeploy: number;
}

export const FEEDBACK_TYPE_COLORS: Record<string, string> = {
  bug: 'bg-red-500/10 text-red-400',
  improvement: 'bg-sky-500/10 text-sky-400',
  accessibility: 'bg-amber-500/10 text-amber-400',
  ux: 'bg-violet-500/10 text-violet-400',
  performance: 'bg-orange-500/10 text-orange-400',
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-foreground-500/10 text-foreground-400',
};

export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  in_progress: 'bg-yellow-500/10 text-yellow-400',
  fixed: 'bg-emerald-500/10 text-emerald-400',
  closed: 'bg-foreground-500/10 text-foreground-500',
  wont_fix: 'bg-foreground-500/10 text-foreground-600',
  duplicate: 'bg-foreground-500/10 text-foreground-500',
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400',
  completed: 'bg-sky-500/10 text-sky-400',
  draft: 'bg-foreground-500/10 text-foreground-500',
  archived: 'bg-foreground-500/10 text-foreground-600',
  paused: 'bg-amber-500/10 text-amber-400',
};

export const APPROVAL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  revoked: 'bg-foreground-500/10 text-foreground-500',
};

export const SESSION_STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-emerald-500/10 text-emerald-400',
  completed: 'bg-sky-500/10 text-sky-400',
  paused: 'bg-amber-500/10 text-amber-400',
  abandoned: 'bg-foreground-500/10 text-foreground-500',
};

export const RESULT_STATUS_COLORS: Record<string, string> = {
  passed: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
  in_progress: 'bg-yellow-500/10 text-yellow-400',
  blocked: 'bg-orange-500/10 text-orange-400',
  skipped: 'bg-foreground-500/10 text-foreground-500',
  needs_retest: 'bg-violet-500/10 text-violet-400',
};

export const REWARD_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-yellow-500/10 text-yellow-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  paid: 'bg-sky-500/10 text-sky-400',
  rejected: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-foreground-500/10 text-foreground-500',
};

export const REWARD_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const DEFECT_REVIEW_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-yellow-500/10 text-yellow-400',
  validated: 'bg-emerald-500/10 text-emerald-400',
  duplicate: 'bg-sky-500/10 text-sky-400',
  not_a_defect: 'bg-foreground-500/10 text-foreground-500',
  linked_to_ticket: 'bg-violet-500/10 text-violet-400',
  resolved: 'bg-emerald-500/10 text-emerald-400',
  retest_required: 'bg-amber-500/10 text-amber-400',
};

export const DEFECT_REVIEW_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  validated: 'Validated',
  duplicate: 'Duplicate',
  not_a_defect: 'Not a Defect',
  linked_to_ticket: 'Linked to Ticket',
  resolved: 'Resolved',
  retest_required: 'Retest Required',
};