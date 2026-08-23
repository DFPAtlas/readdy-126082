import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import type { TicketPriority, TicketSlaRule } from '@/types/support-tickets';
import { PRIORITIES, PRIORITY_LABELS } from '../constants';
import { logAdminEvent } from '../audit';

interface SlaPanelProps {
  siteId: string;
  siteName: string;
  globalRules: TicketSlaRule[];
  siteRules: TicketSlaRule[];
  reload: () => void;
}

interface EditableRule {
  priority: TicketPriority;
  first_response_minutes: number;
  resolution_minutes: number;
  is_active: boolean;
  id?: string;
}

const defaultRule = (p: TicketPriority): EditableRule => ({
  priority: p,
  first_response_minutes: 480,
  resolution_minutes: 2880,
  is_active: true,
});

export default function SlaPanel({ siteId, siteName, globalRules, siteRules, reload }: SlaPanelProps) {
  const [globals, setGlobals] = useState<EditableRule[]>([]);
  const [overrides, setOverrides] = useState<EditableRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);

  useEffect(() => {
    const g = PRIORITIES.map((p) => {
      const r = globalRules.find((x) => x.priority === p);
      return r
        ? { priority: p, first_response_minutes: r.first_response_minutes, resolution_minutes: r.resolution_minutes, is_active: r.is_active, id: r.id }
        : defaultRule(p);
    });
    const o = siteRules.map((r) => ({
      priority: r.priority,
      first_response_minutes: r.first_response_minutes,
      resolution_minutes: r.resolution_minutes,
      is_active: r.is_active,
      id: r.id,
    }));
    setGlobals(g);
    setOverrides(o);
    setFeedback(null);
  }, [globalRules, siteRules]);

  const validate = (r: EditableRule): string | null => {
    if (!Number.isInteger(r.first_response_minutes) || r.first_response_minutes <= 0) return 'First-response must be a positive whole number.';
    if (!Number.isInteger(r.resolution_minutes) || r.resolution_minutes <= 0) return 'Resolution must be a positive whole number.';
    return null;
  };

  const doSaveGlobals = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      for (const r of globals) {
        const err = validate(r);
        if (err) {
          setFeedback({ type: 'error', message: `${PRIORITY_LABELS[r.priority]}: ${err}` });
          setSaving(false);
          return;
        }
        if (r.id) {
          await supabase.from('internal_ticket_sla_rules').update({
            first_response_minutes: r.first_response_minutes,
            resolution_minutes: r.resolution_minutes,
            is_active: r.is_active,
          }).eq('id', r.id);
        } else {
          await supabase.from('internal_ticket_sla_rules').insert({
            site_id: null,
            priority: r.priority,
            first_response_minutes: r.first_response_minutes,
            resolution_minutes: r.resolution_minutes,
            is_active: r.is_active,
          });
        }
      }
      await logAdminEvent('support_sla', 'updated', 'Global SLA rules updated', {});
      setFeedback({ type: 'success', message: 'Global SLA rules saved.' });
      reload();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const doSaveOverrides = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      for (const r of overrides) {
        const err = validate(r);
        if (err) {
          setFeedback({ type: 'error', message: `${PRIORITY_LABELS[r.priority]}: ${err}` });
          setSaving(false);
          return;
        }
        if (r.id) {
          await supabase.from('internal_ticket_sla_rules').update({
            first_response_minutes: r.first_response_minutes,
            resolution_minutes: r.resolution_minutes,
            is_active: r.is_active,
          }).eq('id', r.id);
        } else {
          await supabase.from('internal_ticket_sla_rules').insert({
            site_id: siteId,
            priority: r.priority,
            first_response_minutes: r.first_response_minutes,
            resolution_minutes: r.resolution_minutes,
            is_active: r.is_active,
          });
        }
      }
      await logAdminEvent('support_sla', 'updated', `SLA overrides updated for ${siteName}`, { site_id: siteId });
      setFeedback({ type: 'success', message: 'Site SLA overrides saved.' });
      reload();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const requestGlobalSave = () => {
    setPending(() => doSaveGlobals);
    setConfirmOpen(true);
  };

  const addOverride = (p: TicketPriority) => {
    if (overrides.some((o) => o.priority === p)) return;
    const base = globals.find((g) => g.priority === p) ?? defaultRule(p);
    setOverrides((o) => [...o, { priority: p, first_response_minutes: base.first_response_minutes, resolution_minutes: base.resolution_minutes, is_active: true }]);
  };

  const removeOverride = (p: TicketPriority) => {
    setOverrides((o) => o.filter((x) => x.priority !== p));
  };

  const updateGlobal = (p: TicketPriority, patch: Partial<EditableRule>) =>
    setGlobals((g) => g.map((r) => (r.priority === p ? { ...r, ...patch } : r)));
  const updateOverride = (p: TicketPriority, patch: Partial<EditableRule>) =>
    setOverrides((o) => o.map((r) => (r.priority === p ? { ...r, ...patch } : r)));

  const numCls = 'w-24 text-sm bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40';

  const Row = ({ r, onPatch, onRemove }: { r: EditableRule; onPatch: (patch: Partial<EditableRule>) => void; onRemove?: () => void }) => (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-sm font-medium text-foreground-100 w-24 shrink-0">{PRIORITY_LABELS[r.priority]}</span>
      <div className="flex items-center gap-2">
        <input type="number" min={1} value={r.first_response_minutes} onChange={(e) => onPatch({ first_response_minutes: Number(e.target.value) })} className={numCls} aria-label={`${PRIORITY_LABELS[r.priority]} first response minutes`} />
        <span className="text-xs text-foreground-500">min response</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={1} value={r.resolution_minutes} onChange={(e) => onPatch({ resolution_minutes: Number(e.target.value) })} className={numCls} aria-label={`${PRIORITY_LABELS[r.priority]} resolution minutes`} />
        <span className="text-xs text-foreground-500">min resolution</span>
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
        <input type="checkbox" checked={r.is_active} onChange={(e) => onPatch({ is_active: e.target.checked })} className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40" />
        <span className="text-xs text-foreground-400">Active</span>
      </label>
      {onRemove && (
        <button onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-foreground-400 hover:text-red-400 transition-colors cursor-pointer rounded shrink-0" aria-label={`Remove ${PRIORITY_LABELS[r.priority]} override`}>
          <i className="ri-delete-bin-6-line text-base w-4 h-4 flex items-center justify-center"></i>
        </button>
      )}
    </div>
  );

  const availablePriorities = PRIORITIES.filter((p) => !overrides.some((o) => o.priority === p));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground-100">SLA rules</h3>
        <p className="text-xs text-foreground-500 mt-0.5">First-response and resolution targets drive ticket due dates.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-medium text-foreground-300 uppercase tracking-wider">Global rules</h4>
          <button onClick={requestGlobalSave} disabled={saving} className="text-xs text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap disabled:opacity-40">
            {saving ? 'Saving…' : 'Save global rules'}
          </button>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40 overflow-x-auto">
          {globals.map((r) => (
            <Row key={r.priority} r={r} onPatch={(patch) => updateGlobal(r.priority, patch)} />
          ))}
        </div>
        <p className="text-xs text-foreground-600 mt-1">Changing active global values may affect every site without an override.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-medium text-foreground-300 uppercase tracking-wider">Site overrides</h4>
          <button onClick={doSaveOverrides} disabled={saving} className="text-xs text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap disabled:opacity-40">
            {saving ? 'Saving…' : 'Save overrides'}
          </button>
        </div>
        {overrides.length === 0 ? (
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-5 text-center">
            <p className="text-xs text-foreground-500">No site-specific overrides — this site uses the global rules.</p>
          </div>
        ) : (
          <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40 overflow-x-auto">
            {overrides.map((r) => (
              <Row key={r.priority} r={r} onPatch={(patch) => updateOverride(r.priority, patch)} onRemove={() => removeOverride(r.priority)} />
            ))}
          </div>
        )}

        {availablePriorities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {availablePriorities.map((p) => (
              <button key={p} onClick={() => addOverride(p)} className="px-2.5 py-1 rounded-full text-xs border border-background-300/60 text-foreground-400 hover:text-foreground-200 hover:border-background-400/60 transition-colors cursor-pointer whitespace-nowrap">
                + Override {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {feedback && (
        <div className={`px-3 py-2.5 rounded-md text-sm border ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-400'}`} role="status">
          {feedback.message}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Change global SLA rules"
        message="Changing active global SLA values affects every site without an override. Existing ticket due dates are not recalculated automatically. Continue?"
        confirmLabel="Save changes"
        confirmVariant="accent"
        loading={saving}
        onConfirm={async () => {
          setConfirmOpen(false);
          if (pending) await pending();
        }}
      />
    </div>
  );
}