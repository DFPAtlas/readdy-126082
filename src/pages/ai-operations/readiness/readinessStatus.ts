// ============================================================================
// AI Operations — Production Readiness status presentation maps.
// ============================================================================

import type { ReadinessStatus } from '@/pages/ai-operations/readiness/readinessTypes';
import type { StatusTone } from '@/pages/ai-operations/constants';

export const READINESS_STATUS: Record<ReadinessStatus, { tone: StatusTone; label: string }> = {
  complete: { tone: 'emerald', label: 'Complete' },
  ready: { tone: 'emerald', label: 'Ready' },
  partial: { tone: 'amber', label: 'Partial' },
  required: { tone: 'amber', label: 'Required' },
  blocked: { tone: 'red', label: 'Blocked' },
  not_started: { tone: 'secondary', label: 'Not Started' },
  not_applicable: { tone: 'secondary', label: 'N/A' },
};

export const READINESS_STATUS_ORDER: ReadinessStatus[] = [
  'complete',
  'ready',
  'partial',
  'required',
  'blocked',
  'not_started',
  'not_applicable',
];