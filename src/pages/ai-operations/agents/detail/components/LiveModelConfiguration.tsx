import { Link } from 'react-router-dom';
import type { ResolvedModelAssignment } from '@/pages/ai-operations/agents/detail/agentIntegrations';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface Props {
  state: 'live' | 'empty' | 'unavailable';
  items: ResolvedModelAssignment[];
}

const ASSIGNMENT_LABELS: Record<string, string> = {
  primary: 'Primary',
  fallback: 'Fallback',
  specialist: 'Specialist',
  embedding: 'Embedding',
  vision: 'Vision',
  classification: 'Classification',
};

function assignmentLabel(type: string): string {
  return ASSIGNMENT_LABELS[type] ?? type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function SectionBanner({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
      <i className={`${icon} text-2xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto`}></i>
      <p className="text-sm text-foreground-200 font-label font-medium mt-3">{title}</p>
      <p className="text-xs text-foreground-500 mt-1">{detail}</p>
    </div>
  );
}

export default function LiveModelConfiguration({ state, items }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Registered Model Assignments</h3>
        <span className="text-xs font-label text-foreground-600">{items.length} assignment{items.length === 1 ? '' : 's'}</span>
      </div>

      {state === 'unavailable' && (
        <SectionBanner
          icon="ri-error-warning-line"
          title="Model assignment data unavailable"
          detail="Registered model assignments could not be loaded from the live registry."
        />
      )}

      {state === 'empty' && (
        <SectionBanner
          icon="ri-cpu-line"
          title="No registered model assignment"
          detail="This agent has no active or revoked model assignments in the registry."
        />
      )}

      {state === 'live' && items.length > 0 && (
        <>
          <div className="bg-background-100 border border-background-200/60 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium">Hosting</th>
                    <th className="px-4 py-3 font-medium">Model Status</th>
                    <th className="px-4 py-3 font-medium">Risk</th>
                    <th className="px-4 py-3 font-medium">Fallback</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m, i) => (
                    <tr key={`${m.modelKey}-${m.assignmentType}-${i}`} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-label text-foreground-200 whitespace-nowrap">{assignmentLabel(m.assignmentType)}</td>
                      <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">{m.modelName}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{m.providerName}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{m.hostingType}</td>
                      <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{m.modelStatus}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{m.riskLevel}</td>
                      <td className="px-4 py-3">{m.fallbackEnabled ? <StatusPill tone="accent" label="Enabled" /> : <StatusPill tone="secondary" label="—" />}</td>
                      <td className="px-4 py-3">{m.isActive ? <StatusPill tone="emerald" label="Active" /> : <StatusPill tone="secondary" label="Revoked" />}</td>
                      <td className="px-4 py-3 text-right">
                        {m.modelKey ? (
                          <Link
                            to={`/ai-operations/models/${m.modelKey}`}
                            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Open
                            <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                          </Link>
                        ) : (
                          <span className="text-xs font-label text-foreground-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] font-label text-foreground-600">
            Registered Model Assignment — model runtime is not connected. These are registry assignments, not proof of an active model serving requests.
          </p>
        </>
      )}
    </section>
  );
}