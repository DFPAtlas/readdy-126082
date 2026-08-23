import { categoryLabels, sourceLabels, formatFullDateTime } from '@/pages/support-tickets/constants';
import type { TicketDetailRecord } from '../hooks';

function metaString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = metadata[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

interface CustomerPanelProps {
  ticket: TicketDetailRecord;
  canModify: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-sm text-foreground-200 text-right break-words min-w-0">{children}</span>
    </div>
  );
}

export default function CustomerPanel({ ticket, canModify }: CustomerPanelProps) {
  const sourcePageUrl = metaString(ticket.metadata, ['source_page_url', 'sourcePageUrl']);
  const accountReference = metaString(ticket.metadata, ['account_reference', 'accountReference']);
  const orderReference = metaString(ticket.metadata, ['order_reference', 'orderReference']);

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider mb-2 flex items-center gap-2">
        <i className="ri-user-3-line text-sm w-4 h-4 flex items-center justify-center"></i>
        Customer &amp; Source
      </h2>

      <div className="divide-y divide-background-200/40">
        <Row label="Name">{ticket.customer_name ?? '—'}</Row>
        <Row label="Email">
          {canModify ? (
            <a
              href={`mailto:${ticket.customer_email}`}
              className="text-accent-400 hover:text-accent-300 underline decoration-accent-400/40 underline-offset-2 break-all"
            >
              {ticket.customer_email}
            </a>
          ) : (
            <span className="break-all">{ticket.customer_email}</span>
          )}
        </Row>
        <Row label="Phone">{ticket.customer_phone ?? '—'}</Row>
        <Row label="External ref">{ticket.external_reference ?? '—'}</Row>
        <Row label="Website">{ticket.site_name}</Row>
        {ticket.project_name && <Row label="Project">{ticket.project_name}</Row>}
        {sourcePageUrl && (
          <Row label="Source page">
            <span className="break-all text-xs">{sourcePageUrl}</span>
          </Row>
        )}
        {accountReference && <Row label="Account ref">{accountReference}</Row>}
        {orderReference && <Row label="Order ref">{orderReference}</Row>}
        <Row label="Category">{categoryLabels[ticket.category]}</Row>
        <Row label="Source">{sourceLabels[ticket.source]}</Row>
        <Row label="Created">{formatFullDateTime(ticket.created_at)}</Row>
        <Row label="Last customer reply">
          {ticket.last_customer_reply_at ? formatFullDateTime(ticket.last_customer_reply_at) : '—'}
        </Row>
        <Row label="Last staff reply">
          {ticket.last_staff_reply_at ? formatFullDateTime(ticket.last_staff_reply_at) : '—'}
        </Row>
      </div>
    </div>
  );
}