import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SupportTicketTriage, TriageStatus, TicketCategory } from '@/types/support-tickets';
import { categoryLabels, priorityLabels } from '@/pages/support-tickets/constants';

const TRIAGE_STATUS_LABELS: Record<TriageStatus, string> = {
  queued: 'Queued',
  running: 'Analyzing…',
  completed: 'Completed',
  failed: 'Failed',
  unavailable: 'Unavailable',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-red-500/15 text-red-400',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

const DIAGNOSTIC_LABELS: Record<string, string> = {
  authentication: 'Authentication Check',
  account_status: 'Account Status',
  subscription: 'Subscription',
  billing_state: 'Billing State',
  email_delivery: 'Email Delivery',
  recent_errors: 'Recent Errors',
  api_health: 'API Health',
  permissions: 'Permissions',
};

function categoryName(cat: string | null): string {
  if (!cat) return '—';
  return categoryLabels[cat as TicketCategory] ?? cat;
}

interface TriagePanelProps {
  ticketId: string;
  canRun: boolean;
  canApply: boolean;
  canReply: boolean;
  onRunDiagnostic: () => void;
  onUseResponse: (text: string) => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

export default function TriagePanel({
  ticketId,
  canRun,
  canApply,
  canReply,
  onRunDiagnostic,
  onUseResponse,
  onToast,
}: TriagePanelProps) {
  const [runs, setRuns] = useState<SupportTicketTriage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'run' | 'apply' | 'feedback' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('support_get_ticket_triage', {
      p_ticket_id: ticketId,
    });
    if (e) {
      setError(e.message);
      setLoading(false);
      return;
    }
    setRuns((data ?? []) as SupportTicketTriage[]);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const latest = runs[0] ?? null;

  const runTriage = async () => {
    setBusy('run');
    const { data, error: e } = await supabase.functions.invoke('support-triage-run', {
      body: { ticket_id: ticketId },
    });
    setBusy(null);
    const d = data as { status?: string; message?: string } | null;
    if (e || !d?.status) {
      onToast(e?.message ?? 'Could not start AI triage.', 'error');
      return;
    }
    if (d.status === 'unavailable') {
      onToast(d.message ?? 'AI triage is not configured.', 'error');
    } else {
      onToast(d.message ?? 'AI triage started.', 'success');
    }
    setReloadKey((k) => k + 1);
  };

  const applySuggestion = async () => {
    if (!latest) return;
    setBusy('apply');
    const { data, error: e } = await supabase.rpc('support_apply_ai_suggestion', {
      p_triage_id: latest.id,
    });
    setBusy(null);
    if (e) {
      onToast(e.message || 'Could not apply suggestion.', 'error');
      return;
    }
    const d = data as { applied?: { field: string; value: string }[]; ignored_invalid_team?: boolean } | null;
    const applied = d?.applied ?? [];
    if (applied.length === 0 && !d?.ignored_invalid_team) {
      onToast('No new suggestions to apply.', 'success');
      return;
    }
    let msg = applied.map((a) => `${a.field}: ${a.value}`).join(', ');
    if (d?.ignored_invalid_team) {
      msg += (msg ? ' · ' : '') + 'team suggestion ignored (not authorised for this site)';
    }
    onToast(`Applied — ${msg}`, 'success');
    setReloadKey((k) => k + 1);
  };

  const useResponse = async () => {
    if (!latest?.suggested_response) return;
    if (canReply) {
      await supabase.rpc('support_mark_triage_response_used', { p_triage_id: latest.id });
    }
    onUseResponse(latest.suggested_response);
  };

  const recordFeedback = async (helpful: boolean) => {
    if (!latest) return;
    setBusy('feedback');
    const { error: e } = await supabase.rpc('support_record_triage_feedback', {
      p_triage_id: latest.id,
      p_helpful: helpful,
      p_correct_category: latest.feedback_correct_category ?? false,
      p_correct_team: latest.feedback_correct_team ?? false,
      p_correct_priority: latest.feedback_correct_priority ?? false,
    });
    setBusy(null);
    if (e) {
      onToast(e.message, 'error');
      return;
    }
    onToast('Feedback recorded.', 'success');
    setReloadKey((k) => k + 1);
  };

  const toggleCorrectness = async (field: 'feedback_correct_category' | 'feedback_correct_team' | 'feedback_correct_priority', value: boolean) => {
    if (!latest) return;
    setBusy('feedback');
    const patch: Record<string, boolean> = {};
    patch[field] = value;
    const { error: e } = await supabase.rpc('support_record_triage_feedback', {
      p_triage_id: latest.id,
      p_helpful: latest.feedback_helpful ?? false,
      p_correct_category: field === 'feedback_correct_category' ? value : latest.feedback_correct_category ?? false,
      p_correct_team: field === 'feedback_correct_team' ? value : latest.feedback_correct_team ?? false,
      p_correct_priority: field === 'feedback_correct_priority' ? value : latest.feedback_correct_priority ?? false,
    });
    setBusy(null);
    if (e) onToast(e.message, 'error');
    else setReloadKey((k) => k + 1);
  };

  const confidenceBadge = latest?.confidence ? (
    <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${CONFIDENCE_COLORS[latest.confidence] ?? ''}`}>
      {CONFIDENCE_LABELS[latest.confidence] ?? latest.confidence}
    </span>
  ) : null;

  const aiLabel = (
    <span className="inline-flex items-center gap-1 text-[10px] font-label px-2 py-0.5 rounded-full bg-secondary-500/15 text-secondary-300 whitespace-nowrap">
      <i className="ri-sparkling-line text-xs w-3 h-3 flex items-center justify-center"></i>
      AI-generated suggestion — staff review required
    </span>
  );

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-2">
          <i className="ri-brain-line text-sm w-4 h-4 flex items-center justify-center"></i>
          AI Triage
        </h2>
        {canRun && (
          <button
            type="button"
            onClick={runTriage}
            disabled={busy === 'run'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
            {latest ? 'Re-run triage' : 'Run AI Triage'}
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-2/3 bg-background-200/50 rounded animate-pulse"></div>
            <div className="h-4 w-1/2 bg-background-200/50 rounded animate-pulse"></div>
          </div>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : !latest ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
              <i className="ri-brain-line text-xl text-foreground-500 w-6 h-6 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-foreground-500 mb-3">No AI triage has been run for this ticket.</p>
            {canRun && (
              <button
                type="button"
                onClick={runTriage}
                disabled={busy === 'run'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-sparkling-line w-4 h-4 flex items-center justify-center"></i>
                Run AI Triage
              </button>
            )}
          </div>
        ) : latest.status === 'queued' || latest.status === 'running' ? (
          <div className="flex items-center gap-3 py-2">
            <i className="ri-loader-4-line animate-spin text-accent-400 text-xl w-6 h-6 flex items-center justify-center"></i>
            <div>
              <p className="text-sm text-foreground-200">{TRIAGE_STATUS_LABELS[latest.status]}</p>
              <p className="text-xs text-foreground-500">AI is classifying this ticket…</p>
            </div>
          </div>
        ) : latest.status === 'failed' || latest.status === 'unavailable' ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-3">
            <p className="text-sm text-red-300 flex items-center gap-2">
              <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center"></i>
              AI Triage unavailable
            </p>
            {latest.error_message && (
              <p className="text-xs text-red-400/80 mt-1">{latest.error_message}</p>
            )}
            {canRun && (
              <button
                type="button"
                onClick={runTriage}
                disabled={busy === 'run'}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
                Retry triage
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {latest.security_related && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2.5 flex items-start gap-2">
                <i className="ri-shield-flash-line text-red-400 w-5 h-5 flex items-center justify-center shrink-0"></i>
                <div>
                  <p className="text-sm font-semibold text-red-300">SECURITY REVIEW REQUIRED</p>
                  <p className="text-xs text-red-400/80">AI flagged a possible security issue. Route via security review before any repair.</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {aiLabel}
              {confidenceBadge}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1">Category</p>
                <p className="text-foreground-100 font-medium">
                  {categoryName(latest.category)}
                  {latest.subcategory && <span className="text-foreground-500 font-normal"> · {latest.subcategory}</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1">Priority</p>
                <p className="text-foreground-100 font-medium">{latest.suggested_priority ? priorityLabels[latest.suggested_priority] : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1">Team</p>
                <p className="text-foreground-100 font-medium">{latest.suggested_team_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1">Likely issue</p>
                <p className="text-foreground-100">{latest.likely_issue ?? '—'}</p>
              </div>
            </div>

            {latest.summary && (
              <div className="bg-background-50 border border-background-200/50 rounded-lg p-3">
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1">Summary</p>
                <p className="text-sm text-foreground-200 leading-relaxed">{latest.summary}</p>
              </div>
            )}

            {(latest.suggested_diagnostic || latest.suggested_action) && (
              <div className="bg-background-50 border border-background-200/50 rounded-lg p-3">
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1.5">Suggested diagnostic</p>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm text-foreground-200">
                    {latest.suggested_diagnostic ? DIAGNOSTIC_LABELS[latest.suggested_diagnostic] ?? latest.suggested_diagnostic : latest.suggested_action}
                  </span>
                  <button
                    type="button"
                    onClick={onRunDiagnostic}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary-500 hover:bg-secondary-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-stethoscope-line w-4 h-4 flex items-center justify-center"></i>
                    Run Diagnostic
                  </button>
                </div>
              </div>
            )}

            {latest.suggested_response && (
              <div className="bg-background-50 border border-background-200/50 rounded-lg p-3">
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1.5">Suggested response</p>
                <p className="text-sm text-foreground-200 leading-relaxed italic">"{latest.suggested_response}"</p>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={useResponse}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line w-4 h-4 flex items-center justify-center"></i>
                    Use Response
                  </button>
                  <span className="text-[11px] text-foreground-600">Never auto-sent — you review before sending.</span>
                </div>
              </div>
            )}

            {canApply && (
              <button
                type="button"
                onClick={applySuggestion}
                disabled={busy === 'apply'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-primary-500 hover:bg-primary-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-check-double-line w-4 h-4 flex items-center justify-center"></i>
                Apply recommendation
              </button>
            )}

            {/* Feedback */}
            <div className="border-t border-background-200/50 pt-3">
              {latest.feedback_helpful === null ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground-500 mr-1">Was this helpful?</span>
                  <button
                    type="button"
                    onClick={() => recordFeedback(true)}
                    disabled={busy === 'feedback'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <i className="ri-thumb-up-line w-4 h-4 flex items-center justify-center"></i>
                    Helpful
                  </button>
                  <button
                    type="button"
                    onClick={() => recordFeedback(false)}
                    disabled={busy === 'feedback'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <i className="ri-thumb-down-line w-4 h-4 flex items-center justify-center"></i>
                    Not Helpful
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-foreground-500">Thanks for the feedback.</span>
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen((v) => !v)}
                    className="text-xs text-foreground-400 hover:text-foreground-200 underline transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {feedbackOpen ? 'Hide details' : 'Rate accuracy'}
                  </button>
                </div>
              )}

              {feedbackOpen && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {(['feedback_correct_category', 'feedback_correct_team', 'feedback_correct_priority'] as const).map((field) => {
                    const label = field === 'feedback_correct_category' ? 'Category' : field === 'feedback_correct_team' ? 'Team' : 'Priority';
                    const active = Boolean(latest[field]);
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => toggleCorrectness(field, !active)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                          active
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                            : 'border-background-300/60 text-foreground-400 hover:text-foreground-200'
                        }`}
                      >
                        <i className={`${active ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} w-4 h-4 flex items-center justify-center`}></i>
                        Correct {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}