import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshAccountData, unlinkTicketCustomer } from '@/pages/support-customers/hooks';
import {
  resolutionStatusLabels,
  resolutionStatusColors,
  displayValue,
  verifiedLabel,
  formatShortId,
} from '@/pages/support-customers/constants';
import { formatFullDateTime } from '@/pages/support-tickets/constants';
import LinkCustomerModal from './LinkCustomerModal';
import type { TicketAccount } from '@/types/support-customers';
import type { TicketDetailRecord } from '../hooks';

interface AccountPanelProps {
  ticket: TicketDetailRecord;
  canModify: boolean;
  canRunDiagnostics: boolean;
  account: TicketAccount | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onRunDiagnostics: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-sm text-foreground-200 text-right break-words min-w-0">{children}</span>
    </div>
  );
}

const actionBase =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';

export default function AccountPanel({
  ticket,
  canModify,
  canRunDiagnostics,
  account,
  loading,
  error,
  onRefresh,
  onRunDiagnostics,
  onToast,
}: AccountPanelProps) {
  const navigate = useNavigate();
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const customerId = account?.customer?.customer_id ?? null;
  const isLinked = Boolean(customerId);
  const resolution = account?.resolution_status ?? 'unresolved';

  const handleRefresh = async () => {
    setBusy(true);
    const res = await refreshAccountData(ticket.id);
    onToast(res.message, res.success ? 'success' : 'error');
    setBusy(false);
    onRefresh();
  };

  const handleUnlink = async () => {
    setBusy(true);
    const res = await unlinkTicketCustomer(ticket.id);
    onToast(res.message, res.success ? 'success' : 'error');
    setBusy(false);
    onRefresh();
  };

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-2">
          <i className="ri-account-box-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Account
        </h2>
        <span
          className={`inline-flex items-center text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${resolutionStatusColors[resolution]}`}
        >
          {resolutionStatusLabels[resolution]}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2 py-2">
          <div className="h-4 w-full bg-background-200/60 rounded animate-pulse"></div>
          <div className="h-4 w-3/4 bg-background-200/60 rounded animate-pulse"></div>
          <div className="h-4 w-5/6 bg-background-200/60 rounded animate-pulse"></div>
        </div>
      ) : error ? (
        <p className="text-sm text-red-400 py-1">{error}</p>
      ) : (
        <div className="divide-y divide-background-200/40">
          <Row label="Customer Name">{displayValue(account?.customer?.name)}</Row>
          <Row label="Email">{displayValue(account?.customer?.email)}</Row>
          <Row label="User ID">{formatShortId(customerId)}</Row>
          <Row label="Organisation">{displayValue(account?.organisation?.name)}</Row>
          <Row label="Source Site">{displayValue(account?.source_site?.product)}</Row>
          <Row label="Product">
            {displayValue(account?.products?.[0]?.name ?? account?.source_site?.product)}
          </Row>
          <Row label="Account Status">{displayValue(account?.customer?.status)}</Row>
          <Row label="Email Verification">
            {verifiedLabel(account?.customer?.email_verified ?? null)}
          </Row>
          <Row label="Role">{displayValue(account?.customer?.role)}</Row>
          <Row label="Subscription Status">{displayValue(account?.subscription?.status)}</Row>
          <Row label="Last Login">
            {account?.customer?.last_login
              ? formatFullDateTime(account.customer.last_login)
              : 'Not available'}
          </Row>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          disabled={!customerId}
          onClick={() => customerId && navigate(`/customers/${customerId}`)}
          className={`${actionBase} bg-accent-500 hover:bg-accent-400 text-background-950`}
        >
          <i className="ri-user-line w-4 h-4 flex items-center justify-center"></i>
          View Customer
        </button>

        {canModify && canRunDiagnostics && customerId && (
          <button
            type="button"
            onClick={onRunDiagnostics}
            className={`${actionBase} border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400`}
          >
            <i className="ri-stethoscope-line w-4 h-4 flex items-center justify-center"></i>
            Run Diagnostics
          </button>
        )}

        {canModify && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy}
            className={`${actionBase} border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400`}
          >
            <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
            Refresh
          </button>
        )}

        {canModify && !isLinked && (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className={`${actionBase} border border-background-300/60 text-accent-400 hover:text-accent-300 hover:border-accent-500/40`}
          >
            <i className="ri-link w-4 h-4 flex items-center justify-center"></i>
            Link Customer
          </button>
        )}

        {canModify && isLinked && (
          <button
            type="button"
            onClick={handleUnlink}
            disabled={busy}
            className={`${actionBase} border border-background-300/60 text-red-400 hover:text-red-300 hover:border-red-500/40`}
          >
            <i className="ri-link-unlink w-4 h-4 flex items-center justify-center"></i>
            Unlink
          </button>
        )}
      </div>

      <LinkCustomerModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        ticket={ticket}
        onLinked={() => {
          setLinkOpen(false);
          onRefresh();
        }}
        onToast={onToast}
      />
    </div>
  );
}