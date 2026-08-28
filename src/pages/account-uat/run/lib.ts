/**
 * Tester UAT runner helpers: environment detection, evidence-requirement
 * evaluation, and the local runner data shapes. These are display/enforcement
 * helpers only — all persistence goes through the existing SECURITY DEFINER
 * RPCs (start_uat_session / update_uat_test_case_result / finish_uat_session /
 * prepare_uat_evidence_upload / soft_delete_uat_evidence).
 */

import type { UatJob } from '@/pages/admin/website-uat/types';

export interface EvidenceItem {
  id: string;
  evidence_type: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
}

export interface ExistingResult {
  status: string;
  actualResult: string;
  notes: string;
  blockerReason: string;
}

export interface RunnerCase {
  atcId: string;
  testCaseId: string;
  sortOrder: number;
  atcStatus: string;
  title: string;
  reference: string | null;
  description: string | null;
  preconditions: string | null;
  steps: string[];
  expectedResult: string;
  isRequired: boolean;
  existing: ExistingResult | null;
}

export interface Draft {
  status: '' | 'passed' | 'failed' | 'blocked';
  actualResult: string;
  notes: string;
  blockerReason: string;
}

export interface EnvState {
  device: string;
  browser: string;
  os: string;
  browserVersion: string;
}

/** The assignment statuses that allow the tester to open the runner. */
export const RUNNABLE_ASSIGNMENT_STATUSES = ['assigned', 'reserved', 'in_progress', 'testing'];

/** Terminal result statuses that count toward "completed" progress. */
export const TERMINAL_RESULT_STATUSES = ['passed', 'failed', 'blocked'];

// ── Environment detection (only reliable browser/OS/viewport values) ─────

export function detectBrowser(): { name: string; version: string } {
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua)) {
    const m = ua.match(/edg\/([\d.]+)/i);
    return { name: 'Edge', version: m?.[1] ?? '' };
  }
  if (/firefox\//i.test(ua)) {
    const m = ua.match(/firefox\/([\d.]+)/i);
    return { name: 'Firefox', version: m?.[1] ?? '' };
  }
  if (/chrome\//i.test(ua)) {
    const m = ua.match(/chrome\/([\d.]+)/i);
    return { name: 'Chrome', version: m?.[1] ?? '' };
  }
  if (/safari\//i.test(ua)) {
    const m = ua.match(/version\/([\d.]+)/i);
    return { name: 'Safari', version: m?.[1] ?? '' };
  }
  return { name: '', version: '' };
}

export function detectOS(): string {
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/linux/i.test(ua)) return 'Linux';
  return '';
}

/** Conservative device inference; never treated as authoritative without confirmation. */
export function detectDeviceType(): string {
  const ua = navigator.userAgent;
  if (/ipad/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Maps a detected browser name onto the stored BROWSERS enum value, if any. */
export function browserToEnum(name: string): string {
  const n = name.toLowerCase();
  if (n === 'chrome') return 'chrome';
  if (n === 'edge') return 'edge';
  if (n === 'firefox') return 'firefox';
  if (n === 'safari') return 'safari';
  return '';
}

/** Maps a detected device type onto the stored DEVICES enum value, if any. */
export function deviceTypeToEnum(type: string): string {
  if (type === 'desktop') return 'desktop';
  if (type === 'mobile') return 'iphone';
  if (type === 'tablet') return 'ipad';
  return '';
}

// ── Evidence-requirement evaluation ──────────────────────────────────────

/** Whether a FAIL result requires a screenshot/image evidence attachment. */
export function requiresScreenshotOnFail(job: UatJob | null): boolean {
  const tags = job?.evidence_requirement_tags ?? [];
  return tags.includes('screenshot_on_fail') || tags.includes('video_on_fail');
}

/** Whether a FAIL result requires tester notes. */
export function requiresNotesOnFail(job: UatJob | null): boolean {
  const tags = job?.evidence_requirement_tags ?? [];
  return tags.includes('notes_on_fail');
}

/** Whether device information must be captured before submission. */
export function requiresDeviceInfo(job: UatJob | null): boolean {
  const tags = job?.evidence_requirement_tags ?? [];
  return tags.includes('device_information');
}

/** Whether browser information must be captured before submission. */
export function requiresBrowserInfo(job: UatJob | null): boolean {
  const tags = job?.evidence_requirement_tags ?? [];
  return tags.includes('browser_information');
}

/** Parses the `uat_test_cases.steps` jsonb into an ordered list of strings. */
export function parseSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (typeof s === 'string') return s;
      if (s && typeof s === 'object' && 'instruction' in (s as Record<string, unknown>)) {
        const v = (s as Record<string, unknown>).instruction;
        return typeof v === 'string' ? v : '';
      }
      return '';
    })
    .filter(Boolean);
}