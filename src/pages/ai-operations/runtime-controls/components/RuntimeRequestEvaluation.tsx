import { useState } from 'react';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { useRuntimeGateway, runReadinessEvaluation, resetEvaluation } from '@/pages/ai-operations/runtime-controls/runtimeGatewayStore';

function newIdempotencyKey(orchestration: AiOrchestration): string {
  return `eval-${orchestration.id}-${Date.now()}`;
}

export default function RuntimeRequestEvaluation({ orchestration }: { orchestration: AiOrchestration }) {
  const { evaluation } = useRuntimeGateway();
  const [idemKey] = useState(() => newIdempotencyKey(orchestration));

  const evaluating = evaluation.status === 'evaluating';
  const result = evaluation.result;
  const error = evaluation.error;

  const handleEvaluate = () => {
    void runReadinessEvaluation({
      idempotency_key: idemKey,
      request_type: 'evaluate_orchestration',
      orchestration_key: orchestration.correlationId || orchestration.id,
      requested_action: orchestration.title,
      risk_level: orchestration.riskClass,
      environment: orchestration.environment,
    });
  };

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-shield-keyhole-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime Request Evaluation</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Evaluation-only — routes through the central deny-only runtime gateway.</p>
          </div>
        </div>
        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <i className={`${evaluating ? 'ri-loader-4-line animate-spin' : 'ri-scan-line'} w-4 h-4 flex items-center justify-center`}></i>
          {evaluating ? 'Evaluating…' : 'Evaluate Execution Readiness'}
        </button>
      </div>

      {evaluation.status === 'idle' && (
        <p className="text-xs text-foreground-500">
          Sends an idempotent evaluation request to the gateway. The gateway reloads all authoritative state server-side and returns a fail-closed decision — it never executes an agent, n8n workflow, model or tool.
        </p>
      )}

      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5 flex items-start gap-2">
          <i className="ri-error-warning-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
          <p className="text-xs text-red-300/90">{error}</p>
        </div>
      )}

      {result && !error && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1 whitespace-nowrap">
              <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
              EXECUTION BLOCKED
            </span>
            <span className="text-[11px] text-foreground-600">
              Request <span className="font-mono text-foreground-400">{result.requestKey}</span>
              {result.duplicate && ' · idempotent replay (no duplicate attempt)'}
            </span>
          </div>

          {result.reasons.length > 0 && (
            <div className="space-y-1">
              {result.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground-300">
                  <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}

          {result.gates.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {result.gates.map((g) => (
                <div key={g.key} className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
                  <span className="text-xs text-foreground-300 whitespace-nowrap">{g.label}</span>
                  <GatePill state={g.state} />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={resetEvaluation}
            className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Reset evaluation
          </button>
        </div>
      )}
    </section>
  );
}

function GatePill({ state }: { state: 'pass' | 'block' | 'not_ready' | 'not_required' }) {
  if (state === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
        <i className="ri-check-line w-3 h-3 flex items-center justify-center"></i>
        Pass
      </span>
    );
  }
  if (state === 'block') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
        <i className="ri-close-line w-3 h-3 flex items-center justify-center"></i>
        Block
      </span>
    );
  }
  if (state === 'not_ready') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
        <i className="ri-time-line w-3 h-3 flex items-center justify-center"></i>
        Not Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-300/60 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
      Not Required
    </span>
  );
}