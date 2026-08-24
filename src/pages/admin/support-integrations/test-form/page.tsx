import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthGuard';
import { supabase } from '@/lib/supabase';
import SupportTicketForm, {
  type SupportTicketSubmitResult,
  type SupportTicketFormSubmitPayload,
} from '@/components/feature/SupportTicketForm';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { useSupportSites } from '../hooks';
import { INTEGRATION_MODES } from '../constants';
import type { SupportSite } from '@/types/support-tickets';

function modeLabel(mode: string): string {
  return INTEGRATION_MODES.find((m) => m.value === mode)?.label ?? mode;
}

export default function SupportIntegrationTestForm() {
  const auth = useAuth();
  const navigate = useNavigate();

  const { sites, loading, error, reload } = useSupportSites();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dryRun, setDryRun] = useState<{ state: 'idle' | 'running' | 'done'; message: string }>({ state: 'idle', message: '' });
  const [result, setResult] = useState<{ ticketNumber: string; ticketId: string | null; externalReference: string } | null>(null);

  const confirmResolver = useRef<((v: boolean) => void) | null>(null);
  const externalReference = useRef<string>('');

  const activeSites = useMemo(
    () => sites.filter((s) => s.is_active && !s.archived_at),
    [sites],
  );

  const selected: SupportSite | null = useMemo(
    () => activeSites.find((s) => s.id === selectedId) ?? null,
    [activeSites, selectedId],
  );

  // Reset test state whenever the selected site changes.
  useEffect(() => {
    externalReference.current = `TEST-${Date.now()}`;
    setResult(null);
    setDryRun({ state: 'idle', message: '' });
  }, [selectedId]);

  // Route guard: owner/admin only.
  if (auth.loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-[420px] text-center">
          <div className="w-16 h-16 bg-accent-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-cross-line text-accent-400 text-3xl w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground-50 mb-3">Access denied</h1>
          <p className="text-sm text-foreground-400 mb-8 leading-relaxed">
            Only owners and admins can test support integrations.
          </p>
          <button
            onClick={() => navigate('/support-tickets', { replace: true })}
            className="w-full bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            Back to tickets
          </button>
        </div>
      </div>
    );
  }

  const confirmBeforeSubmit = async (): Promise<boolean> => {
    setConfirmOpen(true);
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
    });
  };

  const resolveConfirm = (v: boolean) => {
    setConfirmOpen(false);
    confirmResolver.current?.(v);
    confirmResolver.current = null;
  };

  const handleSuccess = (res: SupportTicketSubmitResult) => {
    if (!selected || !res.ticketNumber) return;
    setResult({
      ticketNumber: res.ticketNumber,
      ticketId: res.ticketId ?? null,
      externalReference: externalReference.current,
    });
  };

  // Owner/admin-only server-side test-ticket creation via manage-support-integrations.
  // This deliberately does NOT use the public receive-support-ticket endpoint,
  // because the Command Centre origin is not (and must not be) an allowed origin
  // for any production site.
  const submitTestTicket = async (payload: SupportTicketFormSubmitPayload): Promise<SupportTicketSubmitResult> => {
    if (!selected) throw new Error('Select a site before submitting.');

    const { data, error } = await supabase.functions.invoke('manage-support-integrations', {
      body: {
        action: 'create_test_ticket',
        siteId: selected.id,
        customerName: payload.name,
        customerEmail: payload.email,
        subject: payload.subject,
        description: payload.description,
        category: payload.category,
        priority: payload.priority,
      },
    });

    const bodyData = data as
      | { success?: boolean; ticketId?: string; ticketNumber?: string; error?: string }
      | null;

    if (error || !bodyData?.success) {
      // Surface only the safe server-side message; never leak raw SDK/network errors.
      throw new Error(bodyData?.error || 'Could not create the test ticket. Please try again.');
    }

    return {
      ticketNumber: bodyData.ticketNumber ?? null,
      ticketId: bodyData.ticketId ?? null,
    };
  };

  const runDryRun = async () => {
    if (!selected) return;
    setDryRun({ state: 'running', message: '' });
    const endpoint = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/receive-support-ticket`;
    const origin = selected.allowed_origins[0];

    if (!origin) {
      setDryRun({ state: 'done', message: 'This site has no allowed origins configured — add one before testing.' });
      return;
    }

    try {
      // Safe connectivity check — an OPTIONS preflight never creates a ticket.
      const res = await fetch(endpoint, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      });
      if (res.ok || res.status === 204) {
        setDryRun({ state: 'done', message: 'Endpoint reachable. Configuration looks ready (this check does not verify a credential secret).' });
      } else {
        setDryRun({ state: 'done', message: `Endpoint responded with ${res.status}. Check the site configuration.` });
      }
    } catch {
      setDryRun({ state: 'done', message: 'Endpoint unreachable. Check the Supabase function deployment and origin configuration.' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/admin/support-integrations"
            className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
            Back to integrations
          </Link>
          <h1 className="text-2xl font-heading font-bold text-foreground-50 mt-1">Test support form</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Preview the public form for a registered site and run a safe, clearly-marked test submission.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={reload} className="text-sm text-red-300 underline cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
        {/* Site selector */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-foreground-300 uppercase tracking-wider">Active sites</h2>
          {loading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => <div key={i} className="h-16 bg-background-100 rounded-lg animate-pulse"></div>)}
            </div>
          ) : activeSites.length === 0 ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
              <p className="text-sm text-foreground-500">No active sites to test.</p>
            </div>
          ) : (
            activeSites.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left border rounded-lg p-4 transition-colors cursor-pointer ${
                  selected?.id === s.id
                    ? 'border-accent-500/50 bg-accent-500/5'
                    : 'border-background-200/60 bg-background-100 hover:border-background-300/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground-100 truncate">{s.site_name}</span>
                  <span className="text-[10px] font-label px-1.5 py-0.5 rounded uppercase bg-secondary-500/15 text-secondary-300 whitespace-nowrap shrink-0">
                    {modeLabel(s.integration_mode)}
                  </span>
                </div>
                <p className="text-xs text-foreground-500 mt-0.5 font-mono">{s.site_slug}</p>
                {s.domain && <p className="text-xs text-foreground-500 truncate">{s.domain}</p>}
              </button>
            ))
          )}
        </div>

        {/* Form / detail */}
        <div>
          {!selected ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-background-200/60 flex items-center justify-center">
                <i className="ri-global-line text-foreground-500 text-2xl w-7 h-7 flex items-center justify-center"></i>
              </div>
              <h2 className="text-base font-semibold text-foreground-100">Select a site</h2>
              <p className="text-sm text-foreground-500 mt-1">Choose a site to preview and test its public form.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Test mode banner */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2.5">
                  <i className="ri-error-warning-line text-amber-400 text-lg w-5 h-5 flex items-center justify-center mt-0.5"></i>
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Test mode</p>
                    <p className="text-xs text-foreground-400 mt-1 leading-relaxed">
                      Submitting this form will create a <strong className="text-foreground-200">real test ticket</strong> marked with a
                      <code className="font-mono text-amber-300"> TEST-…</code> external reference. Use a non-production test email address.
                      No customer notification is sent.
                    </p>
                  </div>
                </div>
              </div>

              {/* Site info */}
              <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground-500">Site slug</span>
                  <code className="font-mono text-xs text-accent-400">{selected.site_slug}</code>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground-500">Integration mode</span>
                  <span className="text-foreground-200">{modeLabel(selected.integration_mode)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground-500">Allowed origins</span>
                  <span className="text-foreground-200 text-right break-all max-w-[60%]">
                    {selected.allowed_origins.length > 0 ? selected.allowed_origins.join(', ') : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground-500">External reference</span>
                  <code className="font-mono text-xs text-foreground-200">{externalReference.current}</code>
                </div>
              </div>

              {/* Dry-run */}
              <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground-100">Dry-run connectivity check</h3>
                    <p className="text-xs text-foreground-500 mt-0.5">Sends an OPTIONS preflight only — never creates a ticket.</p>
                  </div>
                  <button
                    onClick={runDryRun}
                    disabled={dryRun.state === 'running'}
                    className="inline-flex items-center gap-1.5 border border-background-300/60 hover:border-accent-500/50 text-foreground-200 hover:text-accent-400 px-3.5 py-2 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <i className={`${dryRun.state === 'running' ? 'ri-loader-4-line animate-spin' : 'ri-flashlight-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
                    Run check
                  </button>
                </div>
                {dryRun.message && (
                  <p className="text-sm text-foreground-300 mt-3 bg-background-50 border border-background-200/60 rounded-md p-3 leading-relaxed">
                    {dryRun.message}
                  </p>
                )}
              </div>

              {/* Result */}
              {result && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-4">
                  <div className="flex items-center gap-2.5">
                    <i className="ri-checkbox-circle-line text-emerald-400 text-lg w-5 h-5 flex items-center justify-center"></i>
                    <h3 className="text-sm font-semibold text-emerald-300">Test ticket created</h3>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-foreground-300">
                    <p>Reference: <span className="font-mono text-emerald-300">{result.ticketNumber}</span></p>
                    <p>External reference: <span className="font-mono text-foreground-400">{result.externalReference}</span></p>
                  </div>
                  {result.ticketId && (
                    <Link
                      to={`/support-tickets/${result.ticketId}`}
                      className="inline-flex items-center gap-1.5 mt-3 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-external-link-line text-base w-4 h-4 flex items-center justify-center"></i>
                      Open test ticket
                    </Link>
                  )}
                </div>
              )}

              {/* Embedded form */}
              <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-background-200/60">
                  <span className="text-xs font-medium text-foreground-300 uppercase tracking-wider">Form preview</span>
                </div>
                <SupportTicketForm
                  key={selected.id}
                  siteSlug={selected.site_slug}
                  sourcePageUrl={`https://${selected.domain ?? 'example.com'}/support-test`}
                  externalReference={externalReference.current}
                  context={{ isTest: true }}
                  confirmBeforeSubmit={confirmBeforeSubmit}
                  submitOverride={submitTestTicket}
                  onSuccess={handleSuccess}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => resolveConfirm(false)}
        title="Create a real test ticket?"
        message={`This will submit a real ticket to the "${selected?.site_name ?? ''}" integration with reference ${externalReference.current}. It is marked as a test and no customer notification is sent. Continue?`}
        confirmLabel="Create test ticket"
        confirmVariant="accent"
        onConfirm={() => resolveConfirm(true)}
      />
    </div>
  );
}