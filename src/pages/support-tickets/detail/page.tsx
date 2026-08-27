import { useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import usePermissions from '@/hooks/usePermissions';
import Modal from '@/components/base/Modal';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { useTicketDetail } from './hooks';
import CustomerPanel from './components/CustomerPanel';
import AccountPanel from './components/AccountPanel';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import RepairPanel from './components/RepairPanel';
import SupportSessionPanel from './components/SupportSessionPanel';
import RunDiagnosticModal from '@/pages/support-customers/components/RunDiagnosticModal';
import RepairRequestModal from '@/pages/support-customers/components/RepairRequestModal';
import SessionRequestModal from '@/pages/support-customers/components/SessionRequestModal';
import { useTicketAccount } from '@/pages/support-customers/hooks';
import MessageItem from './components/MessageItem';
import ReplyComposer, { type ReplyMode, type ReplyResult } from './components/ReplyComposer';
import HistoryPanel from './components/HistoryPanel';
import HeaderControls from './components/HeaderControls';
import RoutingPanel from './components/RoutingPanel';
import TriagePanel from './components/TriagePanel';
import ReplyAssistant from './components/ReplyAssistant';
import SaveResolutionModal from './components/SaveResolutionModal';
import NotificationStatus from './components/NotificationStatus';
import {
  statusLabels,
  priorityLabels,
  statusColors,
  priorityColors,
  isOverdue,
  overdueDuration,
  formatFullDateTime,
} from '@/pages/support-tickets/constants';
import type { TicketStatus, TicketPriority } from '@/types/support-tickets';
import type { RecommendedRepair } from '@/types/support-customers';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function SupportTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const perms = usePermissions();
  // Granular permission model (Prompt 14) — replaces the broad owner/admin flag.
  const canModify = perms.can('support.tickets.assign');
  const canReply = perms.canReply;
  const canRunDiagnostics = perms.canRunDiagnostics;
  const canRetryDiagnostics = perms.canRetryDiagnostics;
  const canApproveRepair = perms.canApproveRepair;
  const canRevokeSession = perms.canRevokeSession;
  const canStartSession = perms.canStartSession;
  const canGenerateAiReply = perms.canGenerateAiReply;
  const canRunTriage = perms.canRunTriage;
  const canSaveResolution = perms.canCreateResolutions;

  const { ticket, messages, attachments, events, loading, error, refresh } = useTicketDetail(
    ticketId,
    auth.role,
  );

  const {
    account,
    loading: accountLoading,
    error: accountError,
    refresh: refreshAccount,
  } = useTicketAccount(ticketId);

  const [diagOpen, setDiagOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [repairRequest, setRepairRequest] = useState<{ rec: RecommendedRepair; runId: string | null } | null>(
    null,
  );

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<{ action: () => void; message: string } | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveSummary, setResolveSummary] = useState('');
  const [triageDraft, setTriageDraft] = useState<string | null>(null);
  const [currentDraft, setCurrentDraft] = useState('');
  const [resolutionOpen, setResolutionOpen] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  // ---- Header actions ------------------------------------------------------

  const updateTicket = async (patch: Record<string, unknown>, successMsg: string) => {
    if (!ticket) return;
    const { error } = await supabase
      .from('internal_support_tickets')
      .update(patch)
      .eq('id', ticket.id);
    if (error) {
      showToast(error.message || 'Update failed', 'error');
      return;
    }
    showToast(successMsg, 'success');
    refresh();
  };

  const handleChangePriority = (p: TicketPriority) => {
    updateTicket({ priority: p }, `Priority set to ${priorityLabels[p]}`);
  };

  const handleToggleRead = () => {
    if (!ticket) return;
    updateTicket({ is_unread: !ticket.is_unread }, ticket.is_unread ? 'Marked as read' : 'Marked as unread');
  };

  const requestStatusChange = (s: TicketStatus) => {
    if (!ticket) return;
    if (s === 'spam' || s === 'closed') {
      setConfirm({
        action: () => updateTicket({ status: s }, s === 'spam' ? 'Marked as spam' : 'Ticket closed'),
        message: `Set ${ticket.ticket_number} to "${statusLabels[s]}"? This is reversible but recorded in the audit trail.`,
      });
      return;
    }
    if (s === 'resolved') {
      setResolveSummary('');
      setResolveOpen(true);
      return;
    }
    updateTicket({ status: s }, `Status set to ${statusLabels[s]}`);
  };

  const confirmResolve = () => {
    if (!ticket) return;
    const summary = resolveSummary.trim();
    updateTicket(
      {
        status: 'resolved',
        metadata: summary ? { ...ticket.metadata, resolution_summary: summary } : ticket.metadata,
      },
      'Ticket resolved',
    );
    setResolveOpen(false);
  };

  const handleCopyNumber = async () => {
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket.ticket_number);
      showToast('Ticket number copied', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  };

  // ---- Attachments ---------------------------------------------------------

  const downloadAttachment = async (attachmentId: string) => {
    if (!ticket) return;
    const { data, error } = await supabase.functions.invoke('support-ticket-attachments', {
      body: { action: 'signed_url', attachment_id: attachmentId, ticket_id: ticket.id },
    });
    const d = data as { url?: string } | null;
    if (error || !d?.url) {
      showToast('Could not open attachment', 'error');
      return;
    }
    window.open(d.url, '_blank', 'noopener,noreferrer');
  };

  // ---- Reply / note --------------------------------------------------------

  const handleSendReply = async (
    mode: ReplyMode,
    text: string,
    files: File[],
  ): Promise<ReplyResult> => {
    if (!ticket) return { success: false, message: 'Ticket not loaded.' };
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('internal_add_staff_reply', {
        p_ticket_id: ticket.id,
        p_message_body: text,
        p_is_internal_note: mode === 'note',
      });
      if (error) {
        return { success: false, message: error.message || 'Failed to send.' };
      }
      const result = data as { message_id?: string; ticket_status?: TicketStatus } | null;
      const messageId = result?.message_id;

      // Upload any attachments, linked to the new message.
      if (files.length > 0 && messageId) {
        for (const file of files) {
          const form = new FormData();
          form.append('file', file);
          form.append('ticket_id', ticket.id);
          form.append('message_id', messageId);
          await supabase.functions.invoke('support-ticket-attachments', { body: form });
        }
      }

      // Public replies trigger the customer notification workflow.
      let notifyNote = '';
      if (mode === 'reply') {
        const notif = await supabase.functions.invoke('notify-support-ticket-reply', {
          body: { ticket_id: ticket.id, message_id: messageId, message_body: text },
        });
        const nData = notif?.data as { status?: string } | null;
        if (notif.error || nData?.status === 'not_configured' || nData?.status === 'failed') {
          notifyNote = ' Reply saved, but the customer email notification needs attention.';
        }
      }

      // QuickGuard connector: forward public staff replies on QuickGuard tickets.
      // The browser only ever sends the inserted message UUID — never the reply
      // body, the QuickGuard ticket UUID, or any secret.
      let quickguardNote = '';
      if (mode === 'reply' && ticket.site_slug === 'quickguard' && messageId) {
        const qg = await supabase.functions.invoke('send-quickguard-support-reply', {
          body: { messageId },
        });
        const qgData = qg?.data as { success?: boolean } | null;
        if (qg.error || !qgData?.success) {
          quickguardNote = ' Reply saved in DFP Command, but QuickGuard delivery could not be confirmed.';
        }
      }

      refresh();
      return {
        success: true,
        message: mode === 'reply' ? `Reply sent.${notifyNote}${quickguardNote}` : 'Internal note added.',
      };
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render states -------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="h-8 w-64 bg-background-100 rounded-lg animate-pulse"></div>
        <div className="h-24 bg-background-100 rounded-lg animate-pulse"></div>
        <div className="space-y-2">
          <div className="h-20 bg-background-100 rounded-lg animate-pulse"></div>
          <div className="h-20 bg-background-100 rounded-lg animate-pulse"></div>
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

  if (!ticket) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-mail-close-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Ticket not found</h3>
          <p className="text-sm text-foreground-500">This ticket may have been removed or the link is invalid.</p>
        </div>
      </div>
    );
  }

  const overdue = isOverdue(ticket.due_at, ticket.status);

  const resolvedCustomerId = account?.customer?.customer_id ?? ticket.customer_user_id ?? null;
  const resolvedOrganisationId = account?.organisation?.id ?? null;
  const isOrganisationOnly =
    !resolvedCustomerId &&
    Boolean(resolvedOrganisationId) &&
    account?.resolution_status === 'resolved';
  const hasDiagnosticSubject = Boolean(resolvedCustomerId || isOrganisationOnly);
  const diagSiteId = account?.source_site?.site_id ?? ticket.site_id ?? null;
  const diagSiteName = account?.source_site?.product ?? ticket.site_name;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <BackLink />
            <Link
              to="/support-tickets/preferences"
              className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-settings-3-line w-4 h-4 flex items-center justify-center"></i>
              Notification preferences
            </Link>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs font-mono text-foreground-500">{ticket.ticket_number}</span>
            <button
              type="button"
              onClick={handleCopyNumber}
              aria-label="Copy ticket number"
              className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer"
            >
              <i className="ri-file-copy-line text-sm w-4 h-4 flex items-center justify-center"></i>
            </button>
            {ticket.is_unread && (
              <span className="w-2 h-2 rounded-full bg-accent-500" aria-label="Unread"></span>
            )}
          </div>
          <h1 className="text-xl font-heading font-bold text-foreground-50 mt-1 break-words">{ticket.subject}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-foreground-500">
            <span className="whitespace-nowrap">{ticket.site_name}</span>
            {ticket.domain && <span className="whitespace-nowrap text-foreground-600">· {ticket.domain}</span>}
            <span className="whitespace-nowrap">· created {formatFullDateTime(ticket.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${priorityColors[ticket.priority]}`}>
            {priorityLabels[ticket.priority]}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[ticket.status]}`}>
            {statusLabels[ticket.status]}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 whitespace-nowrap">
              <i className="ri-alarm-warning-line w-3 h-3 flex items-center justify-center"></i>
              {ticket.due_at ? overdueDuration(ticket.due_at) : 'Overdue'}
            </span>
          )}
          {canSaveResolution && (
            <button
              type="button"
              onClick={() => setResolutionOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-background-300/60 text-foreground-400 hover:text-foreground-100 hover:border-foreground-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-archive-drawer-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Save Resolution
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <HeaderControls
        ticket={ticket}
        canModify={canModify}
        onChangeStatus={requestStatusChange}
        onChangePriority={handleChangePriority}
        onToggleRead={handleToggleRead}
        onCopyNumber={handleCopyNumber}
      />

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Conversation + composer */}
        <div className="lg:col-span-2 space-y-3 min-w-0">
          <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-2">
            <i className="ri-chat-3-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Conversation
          </h2>

          {messages.length === 0 ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-12 text-center">
              <p className="text-sm text-foreground-500">No messages yet.</p>
            </div>
          ) : (
            messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                attachments={attachments.filter((a) => a.message_id === m.id)}
                onDownload={downloadAttachment}
              />
            ))
          )}

          <ReplyAssistant
            ticketId={ticket.id}
            canGenerate={canGenerateAiReply}
            baseText={currentDraft}
            onUseReply={(text) => setTriageDraft(text)}
            onToast={showToast}
          />

          <ReplyComposer
            canModify={canReply}
            submitting={submitting}
            onSubmit={handleSendReply}
            injectedText={triageDraft}
            onInjectedConsumed={() => setTriageDraft(null)}
            onDraftChange={setCurrentDraft}
          />
        </div>

        {/* Account + diagnostics + customer + history */}
        <div className="space-y-5 min-w-0">
          <RoutingPanel
            ticket={ticket}
            canAssign={canModify}
            currentUserId={auth.user?.id}
            onChanged={refresh}
          />
          <TriagePanel
            ticketId={ticket.id}
            canRun={canRunTriage}
            canApply={canModify}
            canReply={canReply}
            onRunDiagnostic={() => resolvedCustomerId && setDiagOpen(true)}
            onUseResponse={(text) => setTriageDraft(text)}
            onToast={showToast}
          />
          <AccountPanel
            ticket={ticket}
            canModify={canModify}
            canRunDiagnostics={canRunDiagnostics}
            account={account}
            loading={accountLoading}
            error={accountError}
            onRefresh={refreshAccount}
            onRunDiagnostics={() => hasDiagnosticSubject && setDiagOpen(true)}
            onToast={showToast}
          />
          <SupportSessionPanel
            ticketId={ticket.id}
            canStart={canStartSession}
            canRevoke={canRevokeSession}
            canStartSession={Boolean(resolvedCustomerId)}
            onStartSession={() => setSessionOpen(true)}
            onToast={showToast}
          />
          <RepairPanel ticketId={ticket.id} canApprove={canApproveRepair} onToast={showToast} />
          <CustomerPanel ticket={ticket} canModify={canModify} />
          <DiagnosticsPanel
            ticketId={ticket.id}
            canRun={canRunDiagnostics}
            canRetry={canRetryDiagnostics}
            hasCustomer={hasDiagnosticSubject}
            organisationOnly={isOrganisationOnly}
            onRun={() => hasDiagnosticSubject && setDiagOpen(true)}
            onRetry={() => hasDiagnosticSubject && setDiagOpen(true)}
            onReviewRepair={(rec, runId) => setRepairRequest({ rec, runId })}
          />
          {canModify && <NotificationStatus ticketId={ticket.id} canRetry={canModify} />}
          <HistoryPanel events={events} />
        </div>
      </div>

      {/* Resolve dialog (optional summary) */}
      <Modal open={resolveOpen} onClose={() => setResolveOpen(false)} title="Resolve ticket">
        <div className="p-5">
          <p className="text-sm text-foreground-300 mb-3">Optionally add a resolution summary for the record.</p>
          <textarea
            value={resolveSummary}
            onChange={(e) => setResolveSummary(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="What was the resolution?"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-y"
          />
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => setResolveOpen(false)}
              className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmResolve}
              className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Resolve ticket
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Confirm change"
        message={confirm?.message ?? ''}
        confirmLabel="Confirm"
        confirmVariant="accent"
        onConfirm={() => {
          confirm?.action();
          setConfirm(null);
        }}
      />

      <RunDiagnosticModal
        open={diagOpen}
        onClose={() => setDiagOpen(false)}
        customerId={resolvedCustomerId ?? ''}
        organisationId={resolvedOrganisationId}
        customerName={account?.customer?.name ?? account?.organisation?.name ?? ticket.customer_name}
        customerEmail={account?.customer?.email ?? ticket.customer_email}
        siteId={diagSiteId}
        siteName={diagSiteName}
        userId={resolvedCustomerId ?? undefined}
        ticketId={ticket.id}
        ticketNumber={ticket.ticket_number}
        onStarted={showToast}
        onDone={() => {}}
      />

      <SessionRequestModal
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        customerId={resolvedCustomerId ?? ''}
        customerName={account?.customer?.name ?? ticket.customer_name}
        customerEmail={account?.customer?.email ?? ticket.customer_email}
        siteId={diagSiteId}
        siteName={diagSiteName}
        ticketId={ticket.id}
        ticketNumber={ticket.ticket_number}
        onStarted={showToast}
        onSessionCreated={(id) => navigate(`/support-session/${id}`)}
      />

      <RepairRequestModal
        open={repairRequest !== null}
        onClose={() => setRepairRequest(null)}
        customerId={resolvedCustomerId}
        customerName={account?.customer?.name ?? ticket.customer_name}
        customerEmail={account?.customer?.email ?? ticket.customer_email}
        siteId={diagSiteId}
        siteName={diagSiteName}
        userId={resolvedCustomerId ?? undefined}
        ticketId={ticket.id}
        ticketNumber={ticket.ticket_number}
        diagnosticRunId={repairRequest?.runId ?? null}
        recommendation={repairRequest?.rec ?? null}
        onRequested={showToast}
        onDone={() => setRepairRequest(null)}
      />

      <SaveResolutionModal
        open={resolutionOpen}
        onClose={() => setResolutionOpen(false)}
        ticket={{
          id: ticket.id,
          site_id: ticket.site_id,
          category: ticket.category,
          subject: ticket.subject,
        }}
        onToast={showToast}
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
      to="/support-tickets"
      className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
    >
      <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
      Back to tickets
    </Link>
  );
}