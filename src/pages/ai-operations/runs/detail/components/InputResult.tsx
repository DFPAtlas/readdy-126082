import type { RunInputSummary, RunResultSummary } from '@/pages/ai-operations/types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function InputResult({ input, result }: { input: RunInputSummary; result: RunResultSummary }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Input</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <Field label="Input type" value={input.type} />
          <Field label="Source" value={input.source} />
          <Field label="Summary" value={input.summary} />
          <Field label="Data classification" value={input.dataClassification} />
          <Field label="Size / count" value={input.size} />
          <Field label="Timestamp" value={input.timestamp} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Result</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <Field label="Outcome" value={result.outcome} />
          <Field label="Summary" value={result.summary} />
          <Field label="Records affected" value={result.recordsAffected} />
          {result.confidence !== undefined && <Field label="Confidence" value={result.confidence} />}
          {result.artifactRef !== undefined && <Field label="Artifact reference" value={result.artifactRef} />}
          <Field label="Next action" value={result.nextAction} />
        </div>
      </section>
    </div>
  );
}