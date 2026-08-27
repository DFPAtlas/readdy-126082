import type { ToolConnection } from '@/pages/ai-operations/types';
import { CONFIGURATION_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { Link } from 'react-router-dom';

export default function Overview({ connection }: { connection: ToolConnection }) {
  const config = CONFIGURATION_STATE[connection.configurationState];

  const rows: { label: string; value: string | number; mono?: boolean }[] = [
    { label: 'Owner / team', value: connection.ownerTeam },
    { label: 'Connection reference', value: connection.reference, mono: true },
    { label: 'Last checked', value: connection.lastChecked },
    { label: 'Last successful use', value: connection.lastSuccessfulUse },
    { label: 'Failure count', value: connection.failureCount },
    { label: 'Approval requirement', value: connection.approvalRequired ? 'Required for high-risk actions' : 'Not required' },
    { label: 'Audit requirement', value: connection.auditRequired ? 'Enabled' : 'Not required' },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Overview</h3>
        <StatusPill tone={config.tone} label={config.label} />
      </div>

      <p className="text-sm text-foreground-300 leading-relaxed">{connection.description}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{r.label}</span>
            <span className={`text-sm text-foreground-200 text-right ${r.mono ? 'font-mono' : ''}`}>{r.value}</span>
          </div>
        ))}
      </div>

      {connection.notes && (
        <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
          <p className="text-[11px] font-label text-foreground-500 leading-relaxed">{connection.notes}</p>
        </div>
      )}

      {connection.id === 'CON-MODEL' && (
        <div className="flex items-center justify-between gap-3 bg-accent-500/10 border border-accent-500/20 rounded-md p-3">
          <p className="text-xs text-foreground-300 leading-relaxed">
            This is the connection/service layer. The models themselves are governed in the Models Registry.
          </p>
          <Link
            to="/ai-operations/models"
            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Open Models Registry
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        </div>
      )}

      {connection.id === 'CON-KB' && (
        <div className="flex items-center justify-between gap-3 bg-accent-500/10 border border-accent-500/20 rounded-md p-3">
          <p className="text-xs text-foreground-300 leading-relaxed">
            This is the connection/service layer. The knowledge sources themselves are governed in the Knowledge &amp; Memory Registry.
          </p>
          <Link
            to="/ai-operations/knowledge"
            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Open Knowledge Registry
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        </div>
      )}

      {/* Live allowed / restricted operations (from ai_tool_connections, or
          derived from operation groups in demo mode). */}
      {(() => {
        const allowed = connection.allowedOperations ?? connection.operationGroups.filter((g) => g.riskClass !== 'red').flatMap((g) => g.operations);
        const restricted = connection.restrictedOperations ?? connection.operationGroups.filter((g) => g.riskClass === 'red').flatMap((g) => g.operations);
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
              <p className="text-[11px] font-label text-emerald-400 uppercase tracking-wide mb-2">Allowed operations</p>
              {allowed.length === 0 ? (
                <p className="text-xs text-foreground-600">None specified.</p>
              ) : (
                <ul className="space-y-1">
                  {allowed.map((op) => (
                    <li key={op} className="text-xs text-foreground-300 flex items-start gap-1.5">
                      <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center shrink-0 mt-px"></i>
                      {op}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
              <p className="text-[11px] font-label text-red-400 uppercase tracking-wide mb-2">Restricted operations</p>
              {restricted.length === 0 ? (
                <p className="text-xs text-foreground-600">None specified.</p>
              ) : (
                <ul className="space-y-1">
                  {restricted.map((op) => (
                    <li key={op} className="text-xs text-foreground-300 flex items-start gap-1.5">
                      <i className="ri-forbid-line text-red-400 text-sm w-4 h-4 flex items-center justify-center shrink-0 mt-px"></i>
                      {op}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })()}

      {/* Credential handling — reference label only, never the value. */}
      <div className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md p-3 flex-wrap">
        <p className="text-xs text-foreground-300 leading-relaxed">
          {connection.authenticationType
            ? `Authentication: ${connection.authenticationType} · credential reference ${connection.reference}`
            : `Credential reference: ${connection.reference}`}
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 whitespace-nowrap">
          <i className="ri-eye-off-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Credential value hidden / managed externally
        </span>
      </div>

      <p className="text-[11px] font-label text-foreground-600">
        Live connectivity testing not enabled yet — no external connection is made. No raw credentials are stored or displayed, only safe reference identifiers.
      </p>
    </section>
  );
}