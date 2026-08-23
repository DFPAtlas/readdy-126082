import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SiteRateLimitConfig } from '@/types/support-tickets';
import { logAdminEvent } from '../audit';

interface RateLimitPanelProps {
  siteId: string;
  siteName: string;
  config: SiteRateLimitConfig | null;
  reload: () => void;
}

interface ConfigState {
  network_per_15m: number;
  email_per_hour: number;
  failed_auth_threshold: number;
  block_minutes: number;
  max_body_bytes: number;
}

const DEFAULTS: ConfigState = {
  network_per_15m: 5,
  email_per_hour: 3,
  failed_auth_threshold: 10,
  block_minutes: 15,
  max_body_bytes: 64000,
};

const LIMITS: Record<keyof ConfigState, { min: number; max: number; label: string; hint: string }> = {
  network_per_15m: { min: 1, max: 100, label: 'Network submissions per 15 minutes', hint: 'Per hashed client address.' },
  email_per_hour: { min: 1, max: 100, label: 'Customer email submissions per hour', hint: 'Per hashed email address.' },
  failed_auth_threshold: { min: 1, max: 100, label: 'Failed-authentication threshold', hint: 'Before temporary block.' },
  block_minutes: { min: 1, max: 1440, label: 'Temporary block duration (minutes)', hint: 'How long a blocked subject is held.' },
  max_body_bytes: { min: 1000, max: 200000, label: 'Maximum request body size (bytes)', hint: 'Reject oversized payloads.' },
};

export default function RateLimitPanel({ siteId, siteName, config, reload }: RateLimitPanelProps) {
  const [form, setForm] = useState<ConfigState>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setForm(
      config
        ? {
            network_per_15m: config.network_per_15m,
            email_per_hour: config.email_per_hour,
            failed_auth_threshold: config.failed_auth_threshold,
            block_minutes: config.block_minutes,
            max_body_bytes: config.max_body_bytes,
          }
        : DEFAULTS,
    );
    setFeedback(null);
  }, [config]);

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      for (const key of Object.keys(LIMITS) as Array<keyof ConfigState>) {
        const { min, max } = LIMITS[key];
        const v = form[key];
        if (!Number.isInteger(v) || v < min || v > max) {
          setFeedback({ type: 'error', message: `${LIMITS[key].label} must be between ${min} and ${max}.` });
          setSaving(false);
          return;
        }
      }

      const payload = { site_id: siteId, ...form };
      if (config?.id) {
        const { error } = await supabase.from('internal_support_site_rate_limits').update(payload).eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('internal_support_site_rate_limits').insert(payload);
        if (error) throw error;
      }

      await logAdminEvent('support_rate_limit', 'updated', `Rate limits updated for ${siteName}`, { site_id: siteId });
      setFeedback({ type: 'success', message: 'Rate limits saved.' });
      reload();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground-100">Rate limits</h3>
        <p className="text-xs text-foreground-500 mt-0.5">Effective limits enforced by the ingestion endpoint. Only hashed identifiers are stored.</p>
      </div>

      <div className="space-y-4">
        {Object.entries(LIMITS).map(([key, meta]) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 items-center">
            <div>
              <label className="block text-sm text-foreground-200" htmlFor={`rl-${key}`}>{meta.label}</label>
              <p className="text-xs text-foreground-600">{meta.hint}</p>
            </div>
            <input
              id={`rl-${key}`}
              type="number"
              min={meta.min}
              max={meta.max}
              value={form[key as keyof ConfigState]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
              className="w-full text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            />
          </div>
        ))}
      </div>

      {form.network_per_15m >= 50 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-xs text-foreground-300">
          High rate limits reduce protection against abuse. Consider keeping them near the defaults.
        </div>
      )}

      {feedback && (
        <div className={`px-3 py-2.5 rounded-md text-sm border ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-400'}`} role="status">
          {feedback.message}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40">
          {saving ? 'Saving…' : 'Save rate limits'}
        </button>
      </div>
    </div>
  );
}