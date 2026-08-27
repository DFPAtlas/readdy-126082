import type { SiteCapability } from '@/pages/ai-operations/types';
import { CAPABILITY_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface CapabilitiesSectionProps {
  capabilities: SiteCapability[];
}

export default function CapabilitiesSection({ capabilities }: CapabilitiesSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">AI Capabilities</h3>

      {capabilities.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No capabilities defined.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex flex-wrap gap-2.5">
            {capabilities.map((cap) => {
              const state = CAPABILITY_STATE[cap.state];
              return (
                <div
                  key={cap.key}
                  className="inline-flex items-center gap-2 bg-background-50 border border-background-200/60 rounded-lg pl-3 pr-2 py-1.5"
                >
                  <span className="text-sm text-foreground-300 whitespace-nowrap">{cap.label}</span>
                  <StatusPill tone={state.tone} label={state.label} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}