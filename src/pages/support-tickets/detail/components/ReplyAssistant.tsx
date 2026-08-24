import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  AiReplyAction,
  AiReplySuggestion,
  AiReplyTone,
  KnowledgeArticle,
} from '@/types/support-tickets';

const TONES: { value: AiReplyTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'concise', label: 'Concise' },
  { value: 'technical', label: 'Technical' },
  { value: 'simple', label: 'Simple Explanation' },
];

const QUICK_ACTIONS: { action: AiReplyAction; label: string; icon: string; tone?: AiReplyTone }[] = [
  { action: 'improve', label: 'Improve Draft', icon: 'ri-sparkling-line' },
  { action: 'shorten', label: 'Shorten', icon: 'ri-scissors-line' },
  { action: 'friendlier', label: 'Make Friendlier', icon: 'ri-emotion-happy-line', tone: 'friendly' },
  { action: 'technical', label: 'More Technical', icon: 'ri-code-s-slash-line', tone: 'technical' },
  { action: 'simple', label: 'Explain Simply', icon: 'ri-lightbulb-line', tone: 'simple' },
];

const FACT_META: Record<'confirmed' | 'likely' | 'unknown', { label: string; cls: string; dot: string }> = {
  confirmed: { label: 'Confirmed', cls: 'text-emerald-400', dot: 'bg-emerald-500' },
  likely: { label: 'Likely', cls: 'text-amber-400', dot: 'bg-amber-500' },
  unknown: { label: 'Unknown', cls: 'text-foreground-500', dot: 'bg-foreground-500' },
};

const FEEDBACK_REASONS = [
  'Incorrect',
  'Too long',
  'Too technical',
  'Missing information',
  'Unsafe claim',
  'Other',
];

interface ReplyAssistantProps {
  ticketId: string;
  canGenerate: boolean;
  baseText: string;
  onUseReply: (text: string) => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

export default function ReplyAssistant({
  ticketId,
  canGenerate,
  baseText,
  onUseReply,
  onToast,
}: ReplyAssistantProps) {
  const [tone, setTone] = useState<AiReplyTone>('professional');
  const [suggestions, setSuggestions] = useState<AiReplySuggestion[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeArticle[]>([]);
  const [selectedKnowledge, setSelectedKnowledge] = useState<Set<string>>(new Set());
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'run' | 'feedback' | null>(null);
  const [polling, setPolling] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sRes, kRes] = await Promise.all([
      supabase.rpc('support_get_reply_suggestions', { p_ticket_id: ticketId }),
      supabase.rpc('support_search_related_knowledge', { p_ticket_id: ticketId }),
    ]);
    if (sRes.error) setError(sRes.error.message);
    else setSuggestions((sRes.data ?? []) as AiReplySuggestion[]);
    if (kRes.error) {
      if (!sRes.error) setError(kRes.error.message);
    } else {
      const arts = (kRes.data ?? []) as KnowledgeArticle[];
      setKnowledge(arts);
      // Pre-select site-specific articles by default.
      setSelectedKnowledge((prev) => {
        const next = new Set(prev);
        arts.forEach((a) => next.add(a.id));
        return next;
      });
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while a reply is in flight.
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  const latest = suggestions[0] ?? null;
  const isInFlight = latest && (latest.status === 'queued' || latest.status === 'running');

  const startPolling = useCallback(() => {
    setPolling(true);
    const tick = async () => {
      const { data, error: e } = await supabase.rpc('support_get_reply_suggestions', {
        p_ticket_id: ticketId,
      });
      if (!e) {
        const list = (data ?? []) as AiReplySuggestion[];
        setSuggestions(list);
        const top = list[0];
        if (top && (top.status === 'queued' || top.status === 'running')) {
          pollRef.current = window.setTimeout(tick, 2500);
          return;
        }
      }
      setPolling(false);
    };
    pollRef.current = window.setTimeout(tick, 2500);
  }, [ticketId]);

  const run = async (action: AiReplyAction, runTone: AiReplyTone) => {
    setBusy('run');
    const { data, error: e } = await supabase.functions.invoke('support-reply-run', {
      body: {
        ticket_id: ticketId,
        action,
        tone: runTone,
        base_text: action === 'generate' ? null : baseText || null,
        selected_context: {
          knowledge_ids: Array.from(selectedKnowledge),
          diagnostic_ids: [],
          repair_ids: [],
        },
      },
    });
    setBusy(null);
    const d = data as { status?: string; message?: string } | null;
    if (e || !d?.status) {
      onToast(e?.message ?? 'Could not generate a reply.', 'error');
      return;
    }
    if (d.status === 'unavailable' || d.status === 'failed') {
      onToast(d.message ?? 'AI Reply Assistant unavailable.', 'error');
      await load();
      return;
    }
    onToast(d.message ?? 'Generating reply…', 'success');
    setSuggestions([]);
    startPolling();
  };

  const handleUseReply = async (s: AiReplySuggestion) => {
    if (!s.reply_text) return;
    await supabase.rpc('support_mark_reply_outcome', { p_reply_id: s.id, p_outcome: 'used' });
    onUseReply(s.reply_text);
    onToast('Reply placed in the editor — review before sending.', 'success');
  };

  const discard = async (s: AiReplySuggestion) => {
    await supabase.rpc('support_mark_reply_outcome', { p_reply_id: s.id, p_outcome: 'discarded' });
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    onToast('Suggestion discarded.', 'success');
  };

  const recordFeedback = async (s: AiReplySuggestion, helpful: boolean, reason?: string) => {
    setBusy('feedback');
    const { error: e } = await supabase.rpc('support_record_reply_feedback', {
      p_reply_id: s.id,
      p_helpful: helpful,
      p_reason: reason ?? null,
    });
    setBusy(null);
    if (e) {
      onToast(e.message, 'error');
      return;
    }
    setFeedbackFor(null);
    onToast('Feedback recorded.', 'success');
    await load();
  };

  const insertArticle = (a: KnowledgeArticle) => {
    const snippet = a.summary || a.content;
    onUseReply(snippet);
    onToast('Article added to the reply editor.', 'success');
  };

  const toggleKnowledge = (id: string) => {
    setSelectedKnowledge((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toneButton = (t: AiReplyTone) => (
    <button
      key={t}
      type="button"
      onClick={() => setTone(t)}
      aria-pressed={tone === t}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
        tone === t ? 'bg-background-50 text-foreground-50' : 'text-foreground-500 hover:text-foreground-200'
      }`}
    >
      {TONES.find((x) => x.value === t)?.label}
    </button>
  );

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-2">
          <i className="ri-magic-line text-sm w-4 h-4 flex items-center justify-center"></i>
          AI Reply Assistant
        </h2>
        <span className="text-[10px] text-foreground-600 whitespace-nowrap">Never auto-sent</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Tone */}
        <div>
          <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1.5">Tone</p>
          <div className="inline-flex items-center p-1 rounded-full bg-background-200/60 flex-wrap gap-0.5">
            {TONES.map((t) => toneButton(t.value))}
          </div>
        </div>

        {/* Generate */}
        {canGenerate && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => run('generate', tone)}
              disabled={busy === 'run' || polling}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <i className="ri-magic-line w-4 h-4 flex items-center justify-center"></i>
              {polling ? 'Generating…' : 'Generate Reply'}
            </button>
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.action}
                type="button"
                onClick={() => run(qa.action, qa.tone ?? tone)}
                disabled={busy === 'run' || polling}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className={`${qa.icon} w-4 h-4 flex items-center justify-center`}></i>
                {qa.label}
              </button>
            ))}
          </div>
        )}

        {/* Result */}
        {isInFlight ? (
          <div className="flex items-center gap-3 py-2">
            <i className="ri-loader-4-line animate-spin text-accent-400 text-xl w-6 h-6 flex items-center justify-center"></i>
            <div>
              <p className="text-sm text-foreground-200">Drafting a reply…</p>
              <p className="text-xs text-foreground-500">You can keep working — the draft will appear here.</p>
            </div>
          </div>
        ) : latest && (latest.status === 'failed' || latest.status === 'unavailable') ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-3">
            <p className="text-sm text-red-300 flex items-center gap-2">
              <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center"></i>
              AI Reply Assistant unavailable
            </p>
            {latest.error_message && (
              <p className="text-xs text-red-400/80 mt-1">{latest.error_message}</p>
            )}
            {canGenerate && (
              <button
                type="button"
                onClick={() => run('generate', tone)}
                disabled={busy === 'run'}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
                Retry
              </button>
            )}
          </div>
        ) : latest && latest.reply_text ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-label px-2 py-0.5 rounded-full bg-secondary-500/15 text-secondary-300 whitespace-nowrap">
                <i className="ri-sparkling-line text-xs w-3 h-3 flex items-center justify-center"></i>
                AI-generated suggestion — staff review required
              </span>
            </div>

            <div className="bg-background-50 border border-background-200/50 rounded-lg p-3">
              <p className="text-sm text-foreground-200 leading-relaxed whitespace-pre-wrap">{latest.reply_text}</p>
            </div>

            {/* Facts summary */}
            {latest.facts_summary && latest.facts_summary.length > 0 && (
              <div className="bg-background-50 border border-background-200/50 rounded-lg p-3 space-y-1.5">
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1">Fact check</p>
                {latest.facts_summary.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${FACT_META[f.kind].dot}`}></span>
                    <p className="text-xs text-foreground-400 leading-relaxed">
                      <span className={`font-medium ${FACT_META[f.kind].cls}`}>{FACT_META[f.kind].label}: </span>
                      {f.statement}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Sources */}
            <div className="text-xs text-foreground-500">
              <p className="font-label uppercase tracking-wider text-[11px] mb-1">Based on</p>
              {latest.sources && latest.sources.length > 0 ? (
                <ul className="space-y-0.5">
                  {latest.sources.map((s, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <i className="ri-link text-foreground-600 w-3 h-3 flex items-center justify-center"></i>
                      {s.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-foreground-600">Generated from ticket context only.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleUseReply(latest)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-edit-line w-4 h-4 flex items-center justify-center"></i>
                Use
              </button>
              <button
                type="button"
                onClick={() => discard(latest)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-foreground-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-close-line w-4 h-4 flex items-center justify-center"></i>
                Discard
              </button>
              <span className="text-[11px] text-foreground-600">Review and send through the normal reply flow.</span>
            </div>

            {/* Feedback */}
            <div className="border-t border-background-200/50 pt-3">
              {latest.feedback_helpful === null || latest.feedback_helpful === undefined ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-foreground-500 mr-1">Was this helpful?</span>
                  <button
                    type="button"
                    onClick={() => recordFeedback(latest, true)}
                    disabled={busy === 'feedback'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <i className="ri-thumb-up-line w-4 h-4 flex items-center justify-center"></i>
                    Helpful
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackFor(latest.id)}
                    disabled={busy === 'feedback'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <i className="ri-thumb-down-line w-4 h-4 flex items-center justify-center"></i>
                    Not Helpful
                  </button>
                </div>
              ) : (
                <p className="text-xs text-foreground-500">Thanks for the feedback.</p>
              )}

              {feedbackFor === latest.id && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {FEEDBACK_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => recordFeedback(latest, false, r)}
                      disabled={busy === 'feedback'}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <div className="h-4 w-1/2 bg-background-200/50 rounded animate-pulse"></div>
          </div>
        ) : null}

        {/* Related knowledge */}
        <div className="border-t border-background-200/50 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider">Related Knowledge</p>
            <span className="text-[10px] text-foreground-600">{selectedKnowledge.size} selected</span>
          </div>

          {knowledge.length === 0 ? (
            <p className="text-xs text-foreground-600">No approved knowledge articles for this site yet.</p>
          ) : (
            <div className="space-y-1.5">
              {knowledge.map((a) => (
                <div key={a.id} className="bg-background-50 border border-background-200/50 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleKnowledge(a.id)}
                      aria-pressed={selectedKnowledge.has(a.id)}
                      title={selectedKnowledge.has(a.id) ? 'Deselect' : 'Select'}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${
                        selectedKnowledge.has(a.id)
                          ? 'bg-accent-500 border-accent-500 text-background-950'
                          : 'border-background-300/60 text-transparent'
                      }`}
                    >
                      <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground-200 truncate">{a.title}</p>
                      <p className="text-[10px] text-foreground-600 truncate">
                        {a.site_name ?? 'Global'} · {a.category ?? 'General'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedArticle(expandedArticle === a.id ? null : a.id)}
                      title="View article"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground-400 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer shrink-0"
                    >
                      <i className={`${expandedArticle === a.id ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
                    </button>
                    {canGenerate && (
                      <button
                        type="button"
                        onClick={() => insertArticle(a)}
                        title="Insert into reply"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 transition-colors cursor-pointer shrink-0"
                      >
                        <i className="ri-arrow-go-forward-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </button>
                    )}
                  </div>
                  {expandedArticle === a.id && (
                    <div className="px-3 pb-3 border-t border-background-200/50 pt-2">
                      {a.summary && <p className="text-xs text-foreground-500 mb-1.5">{a.summary}</p>}
                      <p className="text-xs text-foreground-300 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}