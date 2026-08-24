import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthGuard';
import usePermissions from '@/hooks/usePermissions';
import {
  useCustomer360,
  useDiagnosticRuns,
  useDiagnosticDetail,
  useCustomerRepairs,
  useCustomerSessions,
  endSupportSession,
} from '../hooks';
import RunDiagnosticModal from '../components/RunDiagnosticModal';
import DiagnosticResultView from '../components/DiagnosticResultView';
import RepairRequestModal from '../components/RepairRequestModal';
import SessionRequestModal from '../components/SessionRequestModal';
import RevokeSessionModal from '../components/RevokeSessionModal';
import {
  displayValue,
  verifiedLabel,
  formatShortId,
  diagnosticStatusLabels,
  diagnosticStatusColors,
  repairTypeLabel,
  repairRiskLabels,
  repairRiskColors,
  repairStatusLabels,
  repairStatusColors,
  sessionStatusLabels,
  sessionStatusColors,
} from '../constants';
import {
  statusLabels,
  statusColors,
  priorityLabels,
  priorityColors,
  formatFullDateTime,
  formatRelative,
} from '@/pages/support-tickets/constants';
import type { Customer360, RecommendedRepair, SupportSession } from '@/types/support-customers';

type TabKey = 'overview' | 'tickets' | 'activity' | 'subscriptions' | 'diagnostics' | 'repairs' | 'sessions' | 'audit';

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-profile-line' },
  { key: 'tickets', label: 'Tickets', icon: 'ri-ticket-2-line' },
  { key: 'activity', label: 'Activity', icon: 'ri-pulse-line' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'ri-money-pound-circle-line' },
  { key: 'diagnostics', label: 'Diagnostics', icon: 'ri-stethoscope-line' },
  { key: 'repairs', label: 'Repairs', icon: 'ri-tools-line' },
  { key: 'sessions', label: 'Sessions', icon: 'ri-eye-line' },
  { key: 'audit', label: 'Audit', icon: 'ri-history-line' },
];

const actionLabels: Record<string, string> = {
  customer_searched: 'Customer searched',
  customer_opened: 'Customer record opened',
  account_resolved: 'Account resolved',
  account_data_refreshed: 'Account data refreshed',
  ticket_customer_linked: 'Customer linked to ticket',
  ticket_customer_unlinked: 'Customer unlinked from ticket',
  diagnostic_requested: 'Diagnostics requested',
  repair_requested: 'Repair requested',
  repair_reviewed: 'Repair reviewed',
  repair_approved: 'Repair approved',
  repair_rejected: 'Repair rejected',
  repair_execution_started: 'Repair execution started',
  repair_execution_completed: 'Repair executed',
  repair_execution_failed: 'Repair execution failed',
  repair_verified: 'Repair verified',
  repair_retry_requested: 'Repair retry requested',
  repair_cancelled: 'Repair cancelled',
  support_session_requested: 'Support session requested',
  support_session_approved: 'Support session approved',
  support_session_started: 'Support session started',
  support_session_opened: 'Support session opened',
  support_session_expired: 'Support session expired',
  support_session_ended: 'Support session ended',
  support_session_revoked: 'Support session revoked',
  support_session_failed: 'Support session failed',
  support_session_access_denied: 'Support session access denied',
  support_session_viewed_section: 'Support session section viewed',
};

const terminalStatuses = ['resolved', 'closed', 'spam'];

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <p className="text-xs font-label text-foreground-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-heading font-semibold text-foreground-50 mt-1">{value}</p>
    </div>
  );
}

function DefinitionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-foreground-600 shrink-0">{label}</span>
      <span className="text-sm text-foreground-200 text-right break-words min-w-0">{children}</span>
    </div>
  );
}

export default function Customer360Page() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const canModify = auth.role === 'owner' || auth.role === 'admin' || auth.role === 'support_manager';
  const canRunDiagnostics = usePermissions().canRunDiagnostics;
  const { customer, loading, error, refresh } = useCustomer360(customerId);
  const [tab, setTab] = useState<TabKey>('overview');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [repairRequest, setRepairRequest] = useState<{ rec: RecommendedRepair; runId: string | null } | null>(
    null,
  );

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-background-100 rounded-lg animate-pulse"></div>
        <div className="h-24 bg-background-100 rounded-lg animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-background-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => navigate(0)}
            className="text-sm text-red-300 underline mt-1 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-user-unfollow-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Customer not found</h3>
          <p className="text-sm text-foreground-500">This customer may have been removed.</p>
        </div>
      </div>
    );
  }

  const overview = customer.overview;
  const openTickets = (customer.tickets ?? []).filter((t) => !terminalStatuses.includes(t.status));
  const subscription = customer.subscriptions?.[0] ?? null;
  const products = customer.products ?? [];
  const diagSiteName = products.length === 1 ? products[0].name : products.length > 1 ? 'Multiple sites' : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <BackLink />
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="w-12 h-12 rounded-full bg-secondary-400 flex items-center justify-center shrink-0">
              <span className="text-lg font-semibold text-foreground-50">
                {(overview.name ?? overview.email ?? '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-heading font-bold text-foreground-50 break-words">
                {overview.name ?? 'Unknown customer'}
              </h1>
              {overview.email && (
                <a
                  href={`mailto:${overview.email}`}
                  className="text-sm text-accent-400 hover:text-accent-300 underline decoration-accent-400/40 underline-offset-2 break-all"
                >
                  {overview.email}
                </a>
              )}
            </div>
            {overview.status && (
              <span className="inline-flex items-center text-[11px] font-label px-2 py-0.5 rounded-full bg-foreground-500/15 text-foreground-300 whitespace-nowrap capitalize">
                {overview.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Products" value={customer.products?.length ?? 0} />
        <StatCard label="Open Tickets" value={openTickets.length} />
        <StatCard
          label="Last Login"
          value={overview.last_login ? formatRelative(overview.last_login) : 'Not available'}
        />
        <StatCard label="Subscription" value={displayValue(subscription?.status)} />
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-background-100 rounded-full max-w-full overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? 'bg-accent-500 text-background-950 font-semibold'
                : 'text-foreground-400 hover:text-foreground-200'
            }`}
          >
            <i className={`${t.icon} w-4 h-4 flex items-center justify-center`}></i>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        {tab === 'overview' && <OverviewTab customer={customer} />}
        {tab === 'tickets' && <TicketsTab customer={customer} />}
        {tab === 'activity' && <ActivityTab />}
        {tab === 'subscriptions' && <SubscriptionsTab customer={customer} />}
        {tab === 'diagnostics' && (
          <DiagnosticsTab
            customerId={customerId ?? ''}
            canRun={canRunDiagnostics}
            onRun={() => setDiagOpen(true)}
            onReviewRepair={(rec, runId) => setRepairRequest({ rec, runId })}
          />
        )}
        {tab === 'repairs' && <RepairsTab customerId={customerId ?? ''} />}
        {tab === 'sessions' && (
          <SessionsTab
            customerId={customerId ?? ''}
            canModify={canModify}
            onStart={() => setSessionOpen(true)}
            onToast={showToast}
          />
        )}
        {tab === 'audit' && <AuditTab customer={customer} />}
      </div>

      <RunDiagnosticModal
        open={diagOpen}
        onClose={() => setDiagOpen(false)}
        customerId={customerId ?? ''}
        customerName={overview.name}
        customerEmail={overview.email}
        siteId={null}
        siteName={diagSiteName}
        ticketId={null}
        onStarted={showToast}
        onDone={() => refresh()}
      />

      <SessionRequestModal
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        customerId={customerId ?? ''}
        customerName={overview.name}
        customerEmail={overview.email}
        siteId={null}
        siteName={diagSiteName}
        ticketId={null}
        onStarted={showToast}
        onSessionCreated={(id) => navigate(`/support-session/${id}`)}
      />

      <RepairRequestModal
        open={repairRequest !== null}
        onClose={() => setRepairRequest(null)}
        customerId={customerId ?? ''}
        customerName={overview.name}
        customerEmail={overview.email}
        siteId={null}
        siteName={diagSiteName}
        ticketId={null}
        diagnosticRunId={repairRequest?.runId ?? null}
        recommendation={repairRequest?.rec ?? null}
        onRequested={showToast}
        onDone={() => setRepairRequest(null)}
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

function BackLink() {
  return (
    <Link
      to="/customers"
      className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
    >
      <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
      Back to customers
    </Link>
  );
}

function OverviewTab({ customer }: { customer: Customer360 }) {
  const o = customer.overview;
  const products = customer.products ?? [];
  return (
    <div className="divide-y divide-background-200/40">
      <DefinitionRow label="Name">{displayValue(o.name)}</DefinitionRow>
      <DefinitionRow label="Email">{displayValue(o.email)}</DefinitionRow>
      <DefinitionRow label="User ID">{formatShortId(o.customer_id)}</DefinitionRow>
      <DefinitionRow label="Organisation">{displayValue(customer.organisation?.name)}</DefinitionRow>
      <DefinitionRow label="Sites / Products">
        {products.length > 0 ? (
          <span className="space-y-1 flex flex-col items-end">
            {products.map((p) => (
              <span key={p.id}>{p.name ?? 'Unnamed product'}</span>
            ))}
          </span>
        ) : (
          'Not available'
        )}
      </DefinitionRow>
      <DefinitionRow label="Account Status">{displayValue(o.status)}</DefinitionRow>
      <DefinitionRow label="Email Verification">{verifiedLabel(o.email_verified)}</DefinitionRow>
      <DefinitionRow label="Role">{displayValue(o.role)}</DefinitionRow>
      <DefinitionRow label="Created Date">
        {o.created_at ? formatFullDateTime(o.created_at) : 'Not available'}
      </DefinitionRow>
      <DefinitionRow label="Last Login">
        {o.last_login ? formatFullDateTime(o.last_login) : 'Not available'}
      </DefinitionRow>
    </div>
  );
}

function TicketsTab({ customer }: { customer: Customer360 }) {
  const tickets = customer.tickets ?? [];
  if (tickets.length === 0) {
    return <EmptyNote icon="ri-ticket-2-line" text="No support tickets are linked to this customer." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-foreground-500 uppercase tracking-wider border-b border-background-200/60">
            <th className="py-2 pr-3 font-label">Ticket</th>
            <th className="py-2 pr-3 font-label">Subject</th>
            <th className="py-2 pr-3 font-label">Site</th>
            <th className="py-2 pr-3 font-label">Priority</th>
            <th className="py-2 pr-3 font-label">Status</th>
            <th className="py-2 pr-3 font-label">Assigned</th>
            <th className="py-2 font-label">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-background-200/40">
          {tickets.map((t) => (
            <tr key={t.id}>
              <td className="py-2.5 pr-3">
                <Link
                  to={`/support-tickets/${t.id}`}
                  className="font-mono text-xs text-accent-400 hover:text-accent-300 whitespace-nowrap"
                >
                  {t.ticket_number}
                </Link>
              </td>
              <td className="py-2.5 pr-3 text-foreground-200 max-w-[240px] truncate">{t.subject}</td>
              <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">{t.site_name}</td>
              <td className="py-2.5 pr-3">
                <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${priorityColors[t.priority as keyof typeof priorityColors] ?? ''}`}>
                  {priorityLabels[t.priority as keyof typeof priorityLabels] ?? t.priority}
                </span>
              </td>
              <td className="py-2.5 pr-3">
                <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[t.status as keyof typeof statusColors] ?? ''}`}>
                  {statusLabels[t.status as keyof typeof statusLabels] ?? t.status}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                {t.assigned_agent ?? '—'}
              </td>
              <td className="py-2.5 text-foreground-500 whitespace-nowrap">
                {formatFullDateTime(t.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab() {
  return (
    <EmptyNote
      icon="ri-pulse-line"
      text="Login, password reset and account-change events are not yet tracked by this backend."
    />
  );
}

function SubscriptionsTab({ customer }: { customer: Customer360 }) {
  const subs = customer.subscriptions ?? [];
  if (subs.length === 0) {
    return <EmptyNote icon="ri-money-pound-circle-line" text="No subscriptions found for this customer." />;
  }
  return (
    <div className="divide-y divide-background-200/40">
      {subs.map((s) => (
        <div key={s.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold text-foreground-50">{s.name ?? 'Unnamed plan'}</span>
            <span className="inline-flex text-[11px] font-label px-2 py-0.5 rounded-full bg-foreground-500/15 text-foreground-300 capitalize whitespace-nowrap">
              {s.status ?? 'Not available'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 mt-1 text-xs text-foreground-500">
            <span>Customer reference: {s.customer_reference ?? 'Not available'}</span>
            <span>Billing: {s.billing_cycle ?? 'Not available'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiagnosticsTab({
  customerId,
  canRun,
  onRun,
  onReviewRepair,
}: {
  customerId: string;
  canRun: boolean;
  onRun: () => void;
  onReviewRepair?: (rec: RecommendedRepair, runId: string | null) => void;
}) {
  const { runs, loading, error } = useDiagnosticRuns({ customerId });
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRun = runs.find((r) => r.id === activeId) ?? runs[0] ?? null;
  const { detail, loading: detailLoading } = useDiagnosticDetail(activeRun?.id ?? null);

  return (
    <div className="space-y-4">
      {canRun && (
        <button
          type="button"
          onClick={onRun}
          className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-stethoscope-line w-4 h-4 flex items-center justify-center"></i>
          Run Account Diagnostics
        </button>
      )}

      {loading ? (
        <div className="space-y-2">
          <div className="h-16 bg-background-200/50 rounded-lg animate-pulse"></div>
          <div className="h-10 bg-background-200/50 rounded-lg animate-pulse"></div>
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : runs.length === 0 ? (
        <EmptyNote icon="ri-stethoscope-line" text="No diagnostics have been run yet." />
      ) : (
        <div className="space-y-4">
          <div className="bg-background-50 border border-background-200/50 rounded-lg p-4">
            {detailLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-2/3 bg-background-200/50 rounded animate-pulse"></div>
                <div className="h-4 w-1/2 bg-background-200/50 rounded animate-pulse"></div>
              </div>
            ) : detail ? (
              <DiagnosticResultView detail={detail} onReviewRepair={(rec) => onReviewRepair?.(rec, activeRun?.id ?? null)} />
            ) : (
              <p className="text-sm text-foreground-500">Unable to load diagnostic result.</p>
            )}
          </div>

          {runs.length > 1 && (
            <div>
              <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wider mb-1.5">
                Previous runs
              </p>
              <div className="space-y-1">
                {runs.slice(1).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveId(r.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      activeId === r.id
                        ? 'border-accent-500/40 bg-accent-500/5'
                        : 'border-background-200/50 bg-background-50 hover:border-background-300/60'
                    }`}
                  >
                    <span className="text-xs font-mono text-foreground-500">{r.id.slice(0, 8)}…</span>
                    <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${diagnosticStatusColors[r.status] ?? ''}`}>
                      {diagnosticStatusLabels[r.status] ?? r.status}
                    </span>
                    <span className="text-xs text-foreground-500 whitespace-nowrap">
                      {formatRelative(r.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RepairsTab({ customerId }: { customerId: string }) {
  const { repairs, loading, error } = useCustomerRepairs(customerId);
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-16 bg-background-200/50 rounded-lg animate-pulse"></div>
        <div className="h-10 bg-background-200/50 rounded-lg animate-pulse"></div>
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (repairs.length === 0) {
    return <EmptyNote icon="ri-tools-line" text="No repair actions recorded for this customer." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-foreground-500 uppercase tracking-wider border-b border-background-200/60">
            <th className="py-2 pr-3 font-label">Date</th>
            <th className="py-2 pr-3 font-label">Site</th>
            <th className="py-2 pr-3 font-label">Action</th>
            <th className="py-2 pr-3 font-label">Risk</th>
            <th className="py-2 pr-3 font-label">Status</th>
            <th className="py-2 pr-3 font-label">Requested By</th>
            <th className="py-2 pr-3 font-label">Approved By</th>
            <th className="py-2 font-label">Ticket</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-background-200/40">
          {repairs.map((r) => (
            <tr key={r.id}>
              <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                {formatFullDateTime(r.created_at)}
              </td>
              <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">{r.site_name ?? '—'}</td>
              <td className="py-2.5 pr-3 text-foreground-200 whitespace-nowrap">
                {repairTypeLabel(r.action_type)}
              </td>
              <td className="py-2.5 pr-3">
                <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairRiskColors[r.risk_level]}`}>
                  {repairRiskLabels[r.risk_level]}
                </span>
              </td>
              <td className="py-2.5 pr-3">
                <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairStatusColors[r.status]}`}>
                  {repairStatusLabels[r.status]}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                {r.requested_by_name ?? '—'}
              </td>
              <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                {r.approved_by_name ?? '—'}
              </td>
              <td className="py-2.5 text-foreground-500">
                {r.ticket_id ? (
                  <Link
                    to={`/support-tickets/${r.ticket_id}`}
                    className="font-mono text-xs text-accent-400 hover:text-accent-300 whitespace-nowrap"
                  >
                    {r.ticket_id.slice(0, 8)}…
                  </Link>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab({ customer }: { customer: Customer360 }) {
  const activity = customer.activity ?? [];
  if (activity.length === 0) {
    return <EmptyNote icon="ri-history-line" text="No support actions recorded for this customer." />;
  }
  return (
    <div className="divide-y divide-background-200/40">
      {activity.map((a) => (
        <div key={a.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-foreground-200">{actionLabels[a.action] ?? a.action}</p>
            {a.ticket_id && (
              <p className="text-xs text-foreground-600 mt-0.5 font-mono">Ticket {a.ticket_id.slice(0, 8)}…</p>
            )}
          </div>
          <span className="text-xs text-foreground-500 shrink-0 whitespace-nowrap">
            {formatRelative(a.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SessionsTab({
  customerId,
  canModify,
  onStart,
  onToast,
}: {
  customerId: string;
  canModify: boolean;
  onStart: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}) {
  const navigate = useNavigate();
  const auth = useAuth();
  const { sessions, loading, error } = useCustomerSessions(customerId);
  const [revoke, setRevoke] = useState<SupportSession | null>(null);

  const active = sessions.find((s) => s.status === 'active') ?? null;
  const ownActive = active && active.requested_by === auth.user?.id;

  const handleEnd = async () => {
    if (!active) return;
    const res = await endSupportSession(active.id);
    onToast(res.message, res.success ? 'success' : 'error');
  };

  return (
    <div className="space-y-4">
      {canModify && (
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-eye-line w-4 h-4 flex items-center justify-center"></i>
          Start Support Session
        </button>
      )}

      {loading ? (
        <div className="space-y-2">
          <div className="h-16 bg-background-200/50 rounded-lg animate-pulse"></div>
          <div className="h-10 bg-background-200/50 rounded-lg animate-pulse"></div>
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : sessions.length === 0 ? (
        <EmptyNote icon="ri-eye-line" text="No support sessions recorded for this customer." />
      ) : (
        <div className="space-y-4">
          {active && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-label font-semibold text-emerald-300 uppercase tracking-wider">
                  Read-only session active
                </span>
              </div>
              <p className="text-xs text-foreground-300 mt-1.5">
                Started by {active.requested_by_name ?? '—'} · {formatRelative(active.started_at ?? active.created_at)}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {ownActive && (
                  <button
                    type="button"
                    onClick={() => navigate(`/support-session/${active.id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    Open Session
                  </button>
                )}
                {ownActive && (
                  <button
                    type="button"
                    onClick={handleEnd}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-red-500/40 text-red-400 hover:text-red-300 hover:border-red-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-stop-circle-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    End Session
                  </button>
                )}
                {active && !ownActive && canModify && (
                  <button
                    type="button"
                    onClick={() => setRevoke(active)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-red-500/40 text-red-400 hover:text-red-300 hover:border-red-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-forbid-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    Revoke
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-500 uppercase tracking-wider border-b border-background-200/60">
                  <th className="py-2 pr-3 font-label">Date</th>
                  <th className="py-2 pr-3 font-label">Site</th>
                  <th className="py-2 pr-3 font-label">Ticket</th>
                  <th className="py-2 pr-3 font-label">Staff</th>
                  <th className="py-2 pr-3 font-label">Duration</th>
                  <th className="py-2 pr-3 font-label">Status</th>
                  <th className="py-2 font-label">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-200/40">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                      {formatFullDateTime(s.created_at)}
                    </td>
                    <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">{s.site_name ?? '—'}</td>
                    <td className="py-2.5 pr-3">
                      {s.ticket_id ? (
                        <Link
                          to={`/support-tickets/${s.ticket_id}`}
                          className="font-mono text-xs text-accent-400 hover:text-accent-300 whitespace-nowrap"
                        >
                          {s.ticket_number ?? s.ticket_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="text-foreground-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                      {s.requested_by_name ?? '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-foreground-500 whitespace-nowrap">
                      {s.duration_minutes} min
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${sessionStatusColors[s.status]}`}>
                        {sessionStatusLabels[s.status]}
                      </span>
                    </td>
                    <td className="py-2.5 text-foreground-500 max-w-[220px] truncate">{s.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RevokeSessionModal
        open={revoke !== null}
        onClose={() => setRevoke(null)}
        sessionId={revoke?.id ?? null}
        customerName={revoke?.customer_name ?? null}
        onRevoked={onToast}
        onDone={() => setRevoke(null)}
      />
    </div>
  );
}

function EmptyNote({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="py-10 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
        <i className={`${icon} text-xl text-foreground-500 w-6 h-6 flex items-center justify-center`}></i>
      </div>
      <p className="text-sm text-foreground-500">{text}</p>
    </div>
  );
}