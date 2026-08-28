import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRuntimeGateway, refreshGateway } from '@/pages/ai-operations/runtime-controls/runtimeGatewayStore';

/**
 * Display-only "future-runtime request readiness" panel for Agent Detail.
 * Shows the gateway / service-identity / kill-switch / dependency / health-
 * freshness view of this agent. No execution button — readiness only.
 */
export default function AgentRuntimeRequestReadiness({ agentName }: { agentName: string }) {
  const { serviceIdentities, summary, error } = useRuntimeGateway();

  useEffect(() => {
    void refreshGateway();
  }, []);

  const anyActiveIdentity = serviceIdentities.some((i) => i.is_active && i.status !== 'blocked' && i.status !== 'disabled');

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-shield-keyhole-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime Request Readiness</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1 whitespace-nowrap">
          <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
          BLOCKED
        </span>
      </div>

      {error && (
        <p className="text-xs text-amber-400 mb-3">{error}</p>
      )}

      <div className="space-y-1.5">
        <ReadinessRow
          ok
          label="Runtime Gateway"
          okNote="Central deny-only gateway deployed (server-side evaluation)."
          badNote="Gateway unavailable."
        />
        <ReadinessRow
          ok={anyActiveIdentity}
          label="Service Identity"
          okNote="An active, allowlisted service identity is provisioned."
          badNote="All service identities are blocked/disabled — no machine execution permission."
        />
        <ReadinessRow
          ok={false}
          label="Master Kill Switch"
          okNote="Kill switch off."
          badNote="Master kill switch is ON — all execution blocked."
        />
        <ReadinessRow
          ok={false}
          label="Site Execution Gate"
          okNote="Site explicitly allowed."
          badNote="No site execution gate allows this scope (default deny)."
        />
        <ReadinessRow
          ok={false}
          label="Agent Execution Gate"
          okNote="Agent explicitly allowed."
          badNote="No agent execution gate allows this agent (default deny)."
        />
        <ReadinessRow
          ok={false}
          label="Required Runtime Dependencies"
          okNote="Required dependencies (n8n / model) configured + reachable."
          badNote="Required runtime dependencies not configured / not verified."
        />
        <ReadinessRow
          ok={false}
          label="Health Freshness"
          okNote="Fresh healthy check within the safe window."
          badNote="No fresh health evidence — runtime health stale / not checked."
        />
      </div>

      <div className="mt-3 pt-3 border-t border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-foreground-500">
          <strong className="text-foreground-300">{agentName}</strong> cannot be requested for runtime execution — no run, workflow, model or tool action occurs.
        </p>
        <Link
          to="/ai-operations/runtime-controls"
          className="inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
          Execution Gateway ({summary?.requestsEvaluated ?? 0} evaluated)
        </Link>
      </div>
    </section>
  );
}

function ReadinessRow({ ok, label, okNote, badNote }: { ok: boolean; label: string; okNote: string; badNote: string }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-foreground-100">{label}</p>
        <p className="text-xs text-foreground-500 mt-0.5">{ok ? okNote : badNote}</p>
      </div>
      {ok ? (
        <i className="ri-checkbox-circle-line text-emerald-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
      ) : (
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
      )}
    </div>
  );
}