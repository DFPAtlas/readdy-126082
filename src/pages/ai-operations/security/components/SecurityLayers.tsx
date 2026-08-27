import type { PolicyLayerState } from '@/pages/ai-operations/types';
import { POLICY_LAYER_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const LAYERS: { name: string; state: PolicyLayerState; note: string }[] = [
  { name: 'Request', state: 'pass', note: 'Request received and normalised' },
  { name: 'Site Scope', state: 'pass', note: 'Site identity resolved' },
  { name: 'Agent Identity', state: 'pass', note: 'Agent authenticated and identified' },
  { name: 'Environment', state: 'pass', note: 'Target environment confirmed' },
  { name: 'Data Access', state: 'warning', note: 'Data classification checked' },
  { name: 'Knowledge Access', state: 'pass', note: 'Source scope validated' },
  { name: 'Tool Access', state: 'approval_required', note: 'Write/execute gated' },
  { name: 'Action Permission', state: 'approval_required', note: 'RED actions require approval' },
  { name: 'Risk', state: 'warning', note: 'Risk class evaluated' },
  { name: 'Approval', state: 'approval_required', note: 'Human sign-off required' },
  { name: 'Execution Gate', state: 'pass', note: 'Gate conditions met' },
  { name: 'Audit', state: 'pass', note: 'Immutable audit enabled' },
];

export default function SecurityLayers() {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Security Layers</h3>
        <span className="text-[11px] font-label text-foreground-600">Policy evaluation flow · demo</span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {LAYERS.map((layer, i) => {
            const state = POLICY_LAYER_STATE[layer.state];
            return (
              <div key={layer.name} className="relative bg-background-50 border border-background-200/60 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-label text-foreground-600 font-mono">0{i + 1}</span>
                  <StatusPill tone={state.tone} label={state.label} />
                </div>
                <p className="text-sm font-medium text-foreground-100 leading-tight">{layer.name}</p>
                <p className="text-[10px] font-label text-foreground-600 mt-1 leading-snug">{layer.note}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-3">
          Layer states are illustrative and are not enforced against production systems.
        </p>
      </div>
    </section>
  );
}