import { useState } from 'react';
import { Link } from 'react-router-dom';
import usePermissions from '@/hooks/usePermissions';
import { useRepairsOverview } from '@/pages/support-customers/hooks';
import {
  repairTypeLabel,
  repairRiskLabels,
  repairRiskColors,
  repairStatusLabels,
  repairStatusColors,
} from '@/pages/support-customers/constants';
import { formatRelative } from '@/pages/support-tickets/constants';
import RepairReviewModal from '@/pages/support-customers/components/RepairReviewModal';
import type { SupportRepairAction } from '@/types/support-customers';

interface QueueSection {
  title: string;
  icon: string;
  empty: string;
  rows: SupportRepairAction[];
  accent?: string;
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <p className="text-xs font-label text-foreground-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-heading font-semibold mt-1 ${tone ?? 'text-foreground-50'}`}>{value}</p>
    </div>
  );
}

export default function SupportRepairsPage() {
  const { overview, loading, error } = useRepairsOverview();
  const { canApproveRepair } = usePermissions();
  const [review, setReview] = useState<SupportRepairAction | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-background-100 rounded-lg animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-background-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
        <div className="h-48 bg-background-100 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  const m = overview?.metrics;

  const sections: QueueSection[] = [
    {
      title: 'Pending Approval',
      icon: 'ri-time-line',
      empty: 'No repairs awaiting approval.',
      rows: overview?.pending_approval ?? [],
      accent: 'text-amber-400',
    },
    {
      title: 'Executing',
      icon: 'ri-loader-4-line',
      empty: 'No repairs currently executing.',
      rows: overview?.executing ?? [],
      accent: 'text-secondary-300',
    },
    {
      title: 'Failed',
      icon: 'ri-error-warning-line',
      empty: 'No failed repairs.',
      rows: overview?.failed ?? [],
      accent: 'text-red-400',
    },
    {
      title: 'Recently Completed',
      icon: 'ri-check-double-line',
      empty: 'No repairs completed in the last 7 days.',
      rows: overview?.recently_completed ?? [],
      accent: 'text-emerald-400',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground-50">Support Repairs</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Human-approved account repair actions across connected sites.
          </p>
        </div>
        <Link
          to="/support-tickets"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to tickets
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Awaiting Approval" value={m?.awaiting_approval ?? 0} tone="text-amber-400" />
        <MetricCard label="Failed Repairs" value={m?.failed ?? 0} tone="text-red-400" />
        <MetricCard label="Completed Today" value={m?.completed_today ?? 0} tone="text-emerald-400" />
        <MetricCard label="Medium-risk Pending" value={m?.medium_pending ?? 0} tone="text-amber-400" />
      </div>

      {/* Queue sections */}
      {sections.map((section) => (
        <div key={section.title} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-background-200/60">
            <i className={`${section.icon} ${section.accent ?? 'text-foreground-400'} w-4 h-4 flex items-center justify-center`}></i>
            <h2 className="text-xs font-label font-semibold text-foreground-400 uppercase tracking-wider">
              {section.title}
            </h2>
            <span className="text-xs text-foreground-600">{section.rows.length}</span>
          </div>

          {section.rows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-foreground-500 text-center">{section.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-foreground-500 uppercase tracking-wider border-b border-background-200/60">
                    <th className="py-2 pl-4 pr-3 font-label">Customer</th>
                    <th className="py-2 pr-3 font-label">Site</th>
                    <th className="py-2 pr-3 font-label">Ticket</th>
                    <th className="py-2 pr-3 font-label">Action</th>
                    <th className="py-2 pr-3 font-label">Risk</th>
                    <th className="py-2 pr-3 font-label">Requested By</th>
                    <th className="py-2 pr-3 font-label">Age</th>
                    <th className="py-2 pr-3 font-label">Status</th>
                    <th className="py-2 pr-3 font-label"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-background-200/40">
                  {section.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pl-4 pr-3 min-w-[160px]">
                        <p className="text-foreground-200 truncate max-w-[180px]">
                          {r.customer_name ?? r.customer_email ?? 'Not available'}
                        </p>
                        <p className="text-xs font-mono text-foreground-600">{r.id.slice(0, 8)}…</p>
                      </td>
                      <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                        {r.site_name ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        {r.ticket_id ? (
                          <Link
                            to={`/support-tickets/${r.ticket_id}`}
                            className="font-mono text-xs text-accent-400 hover:text-accent-300 whitespace-nowrap"
                          >
                            {r.ticket_id.slice(0, 8)}…
                          </Link>
                        ) : (
                          <span className="text-foreground-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-foreground-200 whitespace-nowrap">
                        {repairTypeLabel(r.action_type)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairRiskColors[r.risk_level]}`}>
                          {repairRiskLabels[r.risk_level]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                        {r.requested_by_name ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                        {formatRelative(r.created_at)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairStatusColors[r.status]}`}>
                          {repairStatusLabels[r.status]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {r.status === 'pending_approval' && canApproveRepair && (
                          <button
                            type="button"
                            onClick={() => setReview(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-shield-check-line w-3.5 h-3.5 flex items-center justify-center"></i>
                            Review
                          </button>
                        )}
                        {(r.status === 'failed' || r.status === 'approved') && canApproveRepair && (
                          <button
                            type="button"
                            onClick={() => setReview(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      <RepairReviewModal
        open={review !== null}
        onClose={() => setReview(null)}
        repair={review}
        onAction={showToast}
        onDone={() => setReview(null)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[120]">
          <div
            className={`px-4 py-3 rounded-lg border text-sm flex items-center gap-2 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.4)] ${
              toast.type === 'success'
                ? 'bg-background-200 border-emerald-500/40 text-emerald-300'
                : 'bg-background-200 border-red-500/40 text-red-300'
            }`}
          >
            <i className={`${toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}