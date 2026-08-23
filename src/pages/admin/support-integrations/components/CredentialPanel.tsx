import { useState } from 'react';
import Modal from '@/components/base/Modal';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import type { SupportSite, TicketApiClient } from '@/types/support-tickets';
import { formatDateTime, INTEGRATION_MODES } from '../constants';
import OriginEditor from './OriginEditor';

interface CredentialPanelProps {
  site: SupportSite;
  credentials: TicketApiClient[];
  reload: () => void;
}

interface IssuedSecret {
  keyPrefix: string;
  secret: string;
  integrationMode: 'public_form' | 'server_to_server';
}

function modeLabel(mode: string): string {
  return INTEGRATION_MODES.find((m) => m.value === mode)?.label ?? mode;
}

// One-time secret display — raw secret is shown exactly once.
function SecretModal({ value, onClose }: { value: IssuedSecret; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState('');

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  };

  return (
    <Modal open onClose={() => {}} title="Store your credential" variant="dialog" className="max-w-lg">
      <div className="p-5 space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-foreground-300 leading-relaxed">
          <strong className="text-amber-400">This secret is shown only once.</strong> Copy and store it
          securely now — it cannot be retrieved again after you close this panel.
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-foreground-500">Key prefix</span>
              <button onClick={() => copy('prefix', value.keyPrefix)} className="text-xs text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap">
                {copied === 'prefix' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code className="block font-mono text-sm text-foreground-100 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 break-all">{value.keyPrefix}</code>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-foreground-500">Raw secret</span>
              <button onClick={() => copy('secret', value.secret)} className="text-xs text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap">
                {copied === 'secret' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code className="block font-mono text-sm text-foreground-100 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 break-all">{value.secret}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-500">Integration mode</span>
            <span className="text-xs text-foreground-200">{modeLabel(value.integrationMode)}</span>
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40" />
          <span className="text-xs text-foreground-400 leading-relaxed">I have securely stored the secret.</span>
        </label>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            disabled={!confirmed}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function CredentialPanel({ site, credentials, reload }: CredentialPanelProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<TicketApiClient | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TicketApiClient | null>(null);
  const [issued, setIssued] = useState<IssuedSecret | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const closeSecret = () => {
    setIssued(null);
    setCreateOpen(false);
    setRotateTarget(null);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground-100">Credentials</h3>
          <p className="text-xs text-foreground-500 mt-0.5">Raw secrets are shown once and stored only as a hash + encrypted ciphertext.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line text-base w-4 h-4 flex items-center justify-center"></i>
          Create credential
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {credentials.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-key-2-line text-foreground-500 text-lg w-5 h-5 flex items-center justify-center"></i>
          </div>
          <p className="text-sm text-foreground-500">No credentials yet. Create one to connect this site.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {credentials.map((c) => {
            const active = c.is_active && !c.revoked_at;
            return (
              <li key={c.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground-100">{c.client_name}</p>
                      <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-foreground-600/15 text-foreground-500'}`}>
                        {active ? 'Active' : 'Revoked'}
                      </span>
                      <span className="text-[10px] font-label px-2 py-0.5 rounded uppercase bg-secondary-500/15 text-secondary-300 whitespace-nowrap">
                        {modeLabel(c.integration_mode)}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-foreground-400 mt-1 break-all">{c.key_prefix}</p>
                    <p className="text-xs text-foreground-500 mt-1">
                      Created {formatDateTime(c.created_at)}
                      {c.last_used_at ? <> · Last used {formatDateTime(c.last_used_at)}</> : ' · Never used'}
                    </p>
                    {c.expires_at && (
                      <p className="text-xs text-foreground-500">Expires {formatDateTime(c.expires_at)}</p>
                    )}
                    {c.allowed_origins.length > 0 && (
                      <p className="text-xs text-foreground-500 mt-1 break-all">
                        Origins: {c.allowed_origins.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setRotateTarget(c)}
                      className="w-8 h-8 flex items-center justify-center text-foreground-400 hover:text-foreground-200 hover:bg-background-200/60 rounded-lg transition-colors cursor-pointer"
                      aria-label={`Rotate ${c.client_name}`}
                      title="Rotate"
                    >
                      <i className="ri-refresh-line text-base w-4 h-4 flex items-center justify-center"></i>
                    </button>
                    {active && (
                      <button
                        onClick={() => setRevokeTarget(c)}
                        className="w-8 h-8 flex items-center justify-center text-foreground-400 hover:text-red-400 hover:bg-background-200/60 rounded-lg transition-colors cursor-pointer"
                        aria-label={`Revoke ${c.client_name}`}
                        title="Revoke"
                      >
                        <i className="ri-close-circle-line text-base w-4 h-4 flex items-center justify-center"></i>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {createOpen && (
        <CredentialFormModal
          title="Create credential"
          site={site}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (payload) => {
            setBusy(true);
            setError('');
            const { data, error: e } = await supabase.functions.invoke('manage-support-integrations', {
              body: { action: 'issue_credential', siteId: site.id, ...payload },
            });
            setBusy(false);
            if (e) {
              setError(e.message || 'Failed to create credential.');
              return false;
            }
            if (!data?.keyPrefix || !data?.secret) {
              setError('Unexpected response from the server.');
              return false;
            }
            setIssued({ keyPrefix: data.keyPrefix, secret: data.secret, integrationMode: payload.integrationMode });
            return true;
          }}
          busy={busy}
        />
      )}

      {rotateTarget && (
        <CredentialFormModal
          title="Rotate credential"
          site={site}
          initialClientName={rotateTarget.client_name}
          initialMode={rotateTarget.integration_mode}
          initialOrigins={rotateTarget.allowed_origins}
          onClose={() => setRotateTarget(null)}
          onSubmit={async (payload) => {
            setBusy(true);
            setError('');
            const { data, error: e } = await supabase.functions.invoke('manage-support-integrations', {
              body: { action: 'rotate_credential', siteId: site.id, oldKeyPrefix: rotateTarget.key_prefix, ...payload },
            });
            setBusy(false);
            if (e) {
              setError(e.message || 'Failed to rotate credential.');
              return false;
            }
            if (!data?.keyPrefix || !data?.secret) {
              setError('Unexpected response from the server.');
              return false;
            }
            setIssued({ keyPrefix: data.keyPrefix, secret: data.secret, integrationMode: payload.integrationMode });
            return true;
          }}
          busy={busy}
        />
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke credential"
        message={`Revoke "${revokeTarget?.client_name ?? ''}"? New requests using this credential will be rejected. Existing tickets and audit history are preserved.`}
        confirmLabel="Revoke"
        confirmVariant="danger"
        loading={busy}
        onConfirm={async () => {
          if (!revokeTarget) return;
          setBusy(true);
          setError('');
          const { error: e } = await supabase.functions.invoke('manage-support-integrations', {
            body: { action: 'revoke_credential', siteId: site.id, keyPrefix: revokeTarget.key_prefix },
          });
          setBusy(false);
          setRevokeTarget(null);
          if (e) setError(e.message || 'Failed to revoke credential.');
          reload();
        }}
      />

      {issued && <SecretModal value={issued} onClose={closeSecret} />}
    </div>
  );
}

interface CredentialFormModalProps {
  title: string;
  site: SupportSite;
  onClose: () => void;
  onSubmit: (payload: {
    clientName: string;
    integrationMode: 'public_form' | 'server_to_server';
    allowedOrigins: string[];
    turnstileRequired: boolean;
    elevatedPriorityAllowed: boolean;
  }) => Promise<boolean>;
  busy: boolean;
  initialClientName?: string;
  initialMode?: 'public_form' | 'server_to_server';
  initialOrigins?: string[];
}

function CredentialFormModal({ title, site, onClose, onSubmit, busy, initialClientName, initialMode, initialOrigins }: CredentialFormModalProps) {
  const [clientName, setClientName] = useState(initialClientName ?? '');
  const [integrationMode, setIntegrationMode] = useState<'public_form' | 'server_to_server'>(initialMode ?? site.integration_mode);
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>(initialOrigins ?? site.allowed_origins ?? []);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [elevatedPriorityAllowed, setElevatedPriorityAllowed] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!clientName.trim()) {
      setErr('Client name is required.');
      return;
    }
    if (integrationMode === 'public_form' && allowedOrigins.length === 0) {
      setErr('Public-form credentials need at least one allowed origin.');
      return;
    }
    const ok = await onSubmit({
      clientName: clientName.trim(),
      integrationMode,
      allowedOrigins,
      turnstileRequired,
      elevatedPriorityAllowed,
    });
    if (!ok) return;
  };

  return (
    <Modal open onClose={onClose} title={title} className="max-w-lg">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="cf-name">Client name</label>
          <input id="cf-name" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40" placeholder="Example contact form" />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="cf-mode">Integration mode</label>
          <select id="cf-mode" value={integrationMode} onChange={(e) => setIntegrationMode(e.target.value as 'public_form' | 'server_to_server')} className="w-full text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40">
            <option value="public_form">Public form</option>
            <option value="server_to_server">Server-to-server</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1">Allowed origins</label>
          <OriginEditor origins={allowedOrigins} onChange={setAllowedOrigins} />
        </div>

        {integrationMode === 'public_form' && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={turnstileRequired} onChange={(e) => setTurnstileRequired(e.target.checked)} className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40" />
            <span className="text-sm text-foreground-200">Require CAPTCHA</span>
          </label>
        )}

        {integrationMode === 'server_to_server' && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={elevatedPriorityAllowed} onChange={(e) => setElevatedPriorityAllowed(e.target.checked)} className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40" />
            <span className="text-sm text-foreground-200">Allow elevated priority (urgent / critical)</span>
          </label>
        )}

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40">
            {busy ? 'Working…' : 'Generate credential'}
          </button>
        </div>
      </div>
    </Modal>
  );
}