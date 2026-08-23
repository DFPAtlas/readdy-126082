import Modal from '@/components/base/Modal';
import type { SupportSite } from '@/types/support-tickets';
import { INTEGRATION_MODES } from '../constants';

interface SetupInstructionsModalProps {
  open: boolean;
  onClose: () => void;
  site: SupportSite | null;
}

const endpoint = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/receive-support-ticket`;

export default function SetupInstructionsModal({ open, onClose, site }: SetupInstructionsModalProps) {
  if (!site) return null;

  const mode = site.integration_mode;
  const modeLabel = INTEGRATION_MODES.find((m) => m.value === mode)?.label ?? mode;

  return (
    <Modal open={open} onClose={onClose} title="Setup instructions" className="max-w-2xl">
      <div className="p-5 space-y-5 text-sm">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground-500">Site slug</span>
            <code className="font-mono text-xs text-accent-400">{site.site_slug}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-500">Integration mode</span>
            <span className="text-foreground-200">{modeLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-500">Ticket endpoint</span>
            <code className="font-mono text-xs text-foreground-200 break-all text-right max-w-[60%]">{endpoint}</code>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground-100">Required headers</h4>
          <ul className="mt-2 space-y-1 text-xs text-foreground-400 list-disc list-inside">
            <li><code className="font-mono text-foreground-300">Content-Type: application/json</code></li>
            {mode === 'server_to_server' ? (
              <>
                <li><code className="font-mono text-foreground-300">X-DFP-Key: YOUR_KEY_PREFIX</code></li>
                <li><code className="font-mono text-foreground-300">X-DFP-Timestamp: YOUR_TIMESTAMP</code></li>
                <li><code className="font-mono text-foreground-300">X-DFP-Nonce: YOUR_NONCE</code></li>
                <li><code className="font-mono text-foreground-300">X-DFP-Signature: YOUR_SIGNATURE</code></li>
              </>
            ) : (
              <li><code className="font-mono text-foreground-300">X-DFP-Site: YOUR_SITE_SLUG</code> (or <code className="font-mono text-foreground-300">siteSlug</code> in body)</li>
            )}
            <li><code className="font-mono text-foreground-300">X-Idempotency-Key: YOUR_IDEMPOTENCY_KEY</code> (optional, recommended)</li>
          </ul>
        </div>

        {mode === 'server_to_server' && (
          <div>
            <h4 className="text-sm font-semibold text-foreground-100">HMAC signature</h4>
            <p className="text-xs text-foreground-500 mt-1 leading-relaxed">
              Sign the canonical string with your server secret using HMAC-SHA256:
            </p>
            <pre className="mt-2 bg-background-100 border border-background-200/60 rounded-md p-3 text-xs font-mono text-foreground-300 overflow-x-auto whitespace-pre-wrap">
{`<timestamp>\\n<nonce>\\n<sha256-hex-of-raw-request-body>`}
            </pre>
            <p className="text-xs text-foreground-500 mt-2 leading-relaxed">
              Send the raw secret only in your backend — never in browser JavaScript. Keep
              <code className="font-mono text-foreground-300"> YOUR_SERVER_SECRET</code> in a server environment variable.
            </p>
          </div>
        )}

        {mode === 'public_form' && (
          <div>
            <h4 className="text-sm font-semibold text-foreground-100">Public form example</h4>
            <pre className="mt-2 bg-background-100 border border-background-200/60 rounded-md p-3 text-xs font-mono text-foreground-300 overflow-x-auto whitespace-pre-wrap">
{`fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    siteSlug: "YOUR_SITE_SLUG",
    customer: { name: "…", email: "…" },
    ticket: { subject: "…", description: "…", category: "general", priority: "normal" },
    consent: { privacyAccepted: true },
    timestamp: new Date().toISOString(),
    nonce: crypto.randomUUID(),
  }),
})`}
            </pre>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-foreground-100">Expected responses</h4>
          <ul className="mt-2 space-y-1 text-xs text-foreground-400 list-disc list-inside">
            <li><code className="font-mono text-foreground-300">201</code> — ticket created</li>
            <li><code className="font-mono text-foreground-300">400</code> — validation failed</li>
            <li><code className="font-mono text-foreground-300">401</code> — bad signature / unknown source</li>
            <li><code className="font-mono text-foreground-300">403</code> — disallowed origin / inactive</li>
            <li><code className="font-mono text-foreground-300">429</code> — rate limited</li>
          </ul>
        </div>

        <div className="bg-accent-500/10 border border-accent-500/20 rounded-lg p-3 text-xs text-foreground-300 leading-relaxed">
          <strong className="text-accent-400">Rotation &amp; testing:</strong> rotate credentials from the
          Credentials tab (the raw secret is shown only once). Test safely from your own backend first,
          and use a stable idempotency key to avoid duplicate tickets on retries.
        </div>
      </div>
    </Modal>
  );
}