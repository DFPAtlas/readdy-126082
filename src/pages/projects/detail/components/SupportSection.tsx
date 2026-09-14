import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Project, Bug, ChangeRequest } from '../types';
import { formatDate } from '../utils';
import type { ProjectSupportData } from '../useProjectSupport';
import type { SupportTicket } from '@/types/support-tickets';
import {
  computeSupportSummary,
  deriveSupportStatus,
  supportIncidents,
  isOpenTicket,
  isResolvedTicket,
  slaState,
  SLA_STYLES,
  SLA_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_STYLES,
  linkedBugForTicket,
  linkedChangeForTicket,
  INCIDENT_SOURCE_LABEL,
  INCIDENT_SOURCE_STYLE,
} from '../supportTypes';
import {
  statusLabels,
  priorityLabels,
  categoryLabels,
  sourceLabels,
  statusColors,
  priorityColors,
} from '@/pages/support-tickets/constants';
import CreateBugModal, { type CreateBugDefaults } from './CreateBugModal';
import CreateChangeRequestModal from './CreateChangeRequestModal';
import LinkSupportTicketModal from './LinkSupportTicketModal';

interface SupportSectionProps {
  project: Project;
  support: ProjectSupportData;
  bugs: Bug[];
  changeRequests: ChangeRequest[];
  onRefresh: () => void;
}

type SupportFilter =
  | 'all'
  | 'open'
  | 'critical'
  | 'high_priority'
  | 'awaiting_customer'
  | 'awaiting_internal'
  | 'resolved'
  | 'linked_bug'
  | 'linked_change'
  | 'incidents';

const FILTERS: { value: SupportFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'critical', label: 'Critical' },
  { value: 'high_priority', label: 'High Priority' },
  { value: 'awaiting_customer', label: 'Awaiting Customer' },
  { value: 'awaiting_internal', label: 'Awaiting Internal' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'linked_bug', label: 'Linked to Bug' },
  { value: 'linked_change', label: 'Linked to Change' },
  { value: 'incidents', label: 'Incidents' },
];

function priorityToSeverity(priority: string): string {
  if (priority === 'critical') return 'critical';
  if (priority === 'high' || priority === 'urgent') return 'high';
  return 'medium';
}

export default function SupportSection({
  project,
  support,
  bugs,
  changeRequests,
  onRefresh,
}: SupportSectionProps) {
  const [filter, setFilter] = useState<SupportFilter>('all');
  const [bugDefaults, setBugDefaults] = useState<CreateBugDefaults | null>(null);
  const [crDefaults, setCrDefaults] = useState<{
    title: string;
    description: string;
    priority: string;
    origin: 'support';
    supportTicketId: string;
  } | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const tickets = support.tickets;
  const summary = computeSupportSummary(tickets, bugs, changeRequests);
  const status = deriveSupportStatus(tickets, Boolean(support.error));
  const incidents = supportIncidents(tickets);

  const filtered = tickets.filter((t) => {
    switch (filter) {
      case 'all':
        return true;
      case 'open':
        return isOpenTicket(t);
      case 'critical':
        return isOpenTicket(t) && t.priority === 'critical';
      case 'high_priority':
        return isOpenTicket(t) && (t.priority === 'high' || t.priority === 'urgent');
      case 'awaiting_customer':
        return t.status === 'waiting_on_customer';
      case 'awaiting_internal':
        return t.status === 'waiting_on_staff';
      case 'resolved':
        return isResolvedTicket(t);
      case 'linked_bug':
        return linkedBugForTicket(bugs, t.id) != null;
      case 'linked_change':
        return linkedChangeForTicket(changeRequests, t.id) != null;
      case 'incidents':
        return incidents.some((i) => i.id === t.id);
      default:
        return true;
    }
  });

  const cards: { label: string; value: string; tone: string }[] = [
    { label: 'Open Tickets', value: String(summary.openTickets), tone: summary.openTickets > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Critical Tickets', value: String(summary.critical), tone: summary.critical > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'High Priority', value: String(summary.highPriority), tone: summary.highPriority > 0 ? 'text-amber-400' : 'text-emerald-400' },
    { label: 'Open Incidents', value: String(summary.openIncidents), tone: summary.openIncidents > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Linked Bugs', value: String(summary.linkedBugs), tone: summary.linkedBugs > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Pending Changes', value: String(summary.pendingChanges), tone: summary.pendingChanges > 0 ? 'text-sky-400' : 'text-emerald-400' },
    { label: 'Awaiting Customer', value: String(summary.awaitingCustomer), tone: summary.awaitingCustomer > 0 ? 'text-yellow-400' : 'text-emerald-400' },
    { label: 'Awaiting Internal', value: String(summary.awaitingInternal), tone: summary.awaitingInternal > 0 ? 'text-orange-400' : 'text-emerald-400' },
    { label: 'Resolved This Month', value: String(summary.resolvedThisMonth), tone: 'text-foreground-200' },
  ];

  // Workstream flow counts (real stored relationships only).
  const linkedBugs = bugs.filter((b) => b.support_ticket_id != null);
  const bugsInBuild = linkedBugs.filter((b) => b.build_item_id != null || b.build_run_id != null).length;
  const bugsInUat = linkedBugs.filter((b) => b.uat_defect_id != null).length;
  const bugsReadyRetest = linkedBugs.filter((b) => b.retest_status === 'ready_for_retest').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground-100">Project Support</h3>
          <p className="text-sm text-foreground-500 mt-1">
            Operational support and incidents for {project.project_name}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-1.5 text-sm text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-link w-4 h-4 flex items-center justify-center"></i>
            Link Ticket
          </button>
          <Link
            to="/support-tickets"
            className="flex items-center gap-1.5 text-sm text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-external-link-line w-4 h-4 flex items-center justify-center"></i>
            Open Global Support
          </Link>
        </div>
      </div>

      {/* Availability / error note (never silent zeroes) */}
      {support.error && (
        <div className="flex items-center justify-between gap-3 bg-red-500/5 border border-red-500/10 rounded-lg px-4 py-3">
          <p className="text-xs text-foreground-500">
            Support data unavailable — {support.error}
          </p>
          <button
            type="button"
            onClick={support.refresh}
            className="text-xs text-red-300 underline whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Status banner */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-label px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${SUPPORT_STATUS_STYLES[status]}`}>
            {SUPPORT_STATUS_LABELS[status]}
          </span>
          <p className="text-sm text-foreground-400">
            {status === 'NOT CONFIGURED' && 'No support tickets are linked to this project yet.'}
            {status === 'CLEAR' && 'No open support or incident problems.'}
            {status === 'ACTIVE' && 'Normal open support tickets exist.'}
            {status === 'DEGRADED' && 'High-priority support or operational issues exist.'}
            {status === 'CRITICAL' && 'Critical unresolved ticket or incident exists.'}
            {status === 'UNKNOWN' && 'Support status cannot be determined.'}
          </p>
        </div>
        {tickets.length === 0 && !support.error && (
          <button
            type="button"
            onClick={() => setShowLinkModal(true)}
            className="text-sm text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer"
          >
            Link a ticket
          </button>
        )}
      </div>

      {/* Critical panel */}
      {summary.critical > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-error-warning-line text-red-400 w-4 h-4 flex items-center justify-center"></i>
            <span className="text-xs font-label font-semibold text-red-400 uppercase tracking-wide">Critical Project Issue</span>
          </div>
          <div className="space-y-2">
            {incidents
              .filter((t) => t.priority === 'critical')
              .map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-3 flex-wrap bg-background-50 border border-red-500/10 rounded-lg px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-red-300">{t.ticket_number}</span>
                      <span className="text-sm text-foreground-100 font-medium line-clamp-1">{t.subject}</span>
                    </div>
                    <p className="text-[11px] text-foreground-500 mt-1">
                      {t.customer_name ? `${t.customer_name} · ` : ''}Opened {formatDate(t.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/support-tickets/${t.id}`} className="text-[11px] text-red-300 hover:text-red-200 whitespace-nowrap no-underline">
                      Open Ticket
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
            <p className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap mb-2">{c.label}</p>
            <p className={`text-lg font-heading font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-label transition-colors whitespace-nowrap cursor-pointer ${
              filter === f.value
                ? 'bg-accent-500/10 text-accent-400 font-semibold'
                : 'text-foreground-500 hover:text-foreground-300 hover:bg-background-200/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {support.loading ? (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-14 text-center text-sm text-foreground-500 animate-pulse">
          Loading support tickets…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-lifebuoy-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h4 className="text-sm font-heading font-semibold text-foreground-200 mb-1">
            {tickets.length === 0 ? 'No support tickets' : 'No tickets match this filter'}
          </h4>
          <p className="text-sm text-foreground-500">
            {tickets.length === 0 ? 'No support tickets are linked to this project.' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              linkedBug={linkedBugForTicket(bugs, t.id)}
              linkedChange={linkedChangeForTicket(changeRequests, t.id)}
              onOpenCreateBug={() =>
                setBugDefaults({
                  title: t.subject,
                  description: '',
                  severity: priorityToSeverity(t.priority),
                  source: 'support',
                  supportTicketId: t.id,
                })
              }
              onOpenCreateChange={() =>
                setCrDefaults({
                  title: `Change: ${t.subject}`,
                  description: '',
                  priority: t.priority === 'critical' || t.priority === 'urgent' ? 'high' : 'medium',
                  origin: 'support',
                  supportTicketId: t.id,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Incident panel */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
          <i className="ri-shield-flash-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
          Project Incidents
        </h4>
        {incidents.length === 0 ? (
          <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-6 text-center">
            <p className="text-sm text-foreground-500">No open incidents for this project.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {incidents.map((t) => (
              <div key={t.id} className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-label px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${INCIDENT_SOURCE_STYLE}`}>
                        {INCIDENT_SOURCE_LABEL}
                      </span>
                      <span className="text-sm font-medium text-foreground-100 line-clamp-1">{t.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${priorityColors[t.priority] ?? ''}`}>
                        {priorityLabels[t.priority]}
                      </span>
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${statusColors[t.status] ?? ''}`}>
                        {statusLabels[t.status]}
                      </span>
                      <span className="text-[11px] text-foreground-500">Started {formatDate(t.created_at)}</span>
                    </div>
                  </div>
                  <Link to={`/support-tickets/${t.id}`} className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap no-underline">
                    Open Ticket
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-foreground-600 mt-2">
          AI Operations and monitoring incidents are not yet linked to individual projects.{' '}
          <Link to="/ai-operations" className="text-accent-400 hover:text-accent-300 no-underline">Open AI Operations</Link>{' · '}
          <Link to="/system-status" className="text-accent-400 hover:text-accent-300 no-underline">Open Monitoring</Link>
        </p>
      </section>

      {/* Support workstream flow */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
          <i className="ri-git-branch-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
          Support Workstream
        </h4>
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <FlowStep label="Tickets" value={summary.openTickets} icon="ri-lifebuoy-line" />
            <FlowArrow />
            <FlowStep label="Bug / Change" value={summary.linkedBugs + summary.pendingChanges} icon="ri-git-pull-request-line" />
            <FlowArrow />
            <FlowStep label="Build" value={bugsInBuild} icon="ri-hammer-line" />
            <FlowArrow />
            <FlowStep label="UAT" value={bugsInUat + bugsReadyRetest} icon="ri-clipboard-line" />
            <FlowArrow />
            <FlowStep label="Resolution" value={summary.resolvedThisMonth} icon="ri-check-double-line" />
          </div>
          <p className="text-[10px] text-foreground-600 mt-3">
            Counts reflect only stored relationships — closing one system never silently closes another.
          </p>
        </div>
      </section>

      {/* Recent support activity */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
          <i className="ri-history-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
          Recent Support Activity
        </h4>
        {support.events.length === 0 ? (
          <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-6 text-center">
            <p className="text-sm text-foreground-500">No recent support activity.</p>
          </div>
        ) : (
          <div className="divide-y divide-background-200/60 bg-background-50 border border-background-200/60 rounded-lg overflow-hidden">
            {support.events.slice(0, 10).map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-xs text-foreground-300 line-clamp-1">{e.description || e.event_type}</span>
                <span className="text-[10px] text-foreground-600 shrink-0">{formatDate(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      {bugDefaults && (
        <CreateBugModal
          open
          onClose={() => setBugDefaults(null)}
          onCreated={() => {
            setBugDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={bugDefaults}
          originLabel="Support Ticket"
        />
      )}
      {crDefaults && (
        <CreateChangeRequestModal
          open
          onClose={() => setCrDefaults(null)}
          onCreated={() => {
            setCrDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={{ ...crDefaults, origin: 'support' as const }}
          originLabel="Support Ticket"
        />
      )}
      {showLinkModal && (
        <LinkSupportTicketModal
          open
          onClose={() => setShowLinkModal(false)}
          onLinked={() => {
            setShowLinkModal(false);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
        />
      )}
    </div>
  );
}

// ─── Small building blocks ──────────────────────────────────────────────

function FlowStep({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 min-w-[88px]">
      <i className={`${icon} text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
      <span className="text-lg font-heading font-bold text-foreground-50 leading-none">{value}</span>
      <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
    </div>
  );
}

function FlowArrow() {
  return <i className="ri-arrow-right-line text-foreground-600 w-4 h-4 flex items-center justify-center"></i>;
}

interface TicketRowProps {
  ticket: SupportTicket;
  linkedBug: Bug | null;
  linkedChange: ChangeRequest | null;
  onOpenCreateBug: () => void;
  onOpenCreateChange: () => void;
}

function TicketRow({ ticket, linkedBug, linkedChange, onOpenCreateBug, onOpenCreateChange }: TicketRowProps) {
  const sla = slaState(ticket);
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-xs font-mono text-foreground-400">{ticket.ticket_number}</span>
            <Link to={`/support-tickets/${ticket.id}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors line-clamp-1 cursor-pointer">
              {ticket.subject}
            </Link>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${statusColors[ticket.status] ?? ''}`}>
              {statusLabels[ticket.status]}
            </span>
            <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${priorityColors[ticket.priority] ?? ''}`}>
              {priorityLabels[ticket.priority]}
            </span>
            <span className="text-[10px] font-label text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
              {categoryLabels[ticket.category]}
            </span>
            <span className="text-[10px] font-label text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
              {sourceLabels[ticket.source]}
            </span>
            {sla !== 'none' && (
              <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${SLA_STYLES[sla]}`}>
                {SLA_LABELS[sla]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-foreground-500 mt-1.5 flex-wrap">
            {ticket.customer_name && <span>{ticket.customer_name}</span>}
            {ticket.assigned_agent && <span>Assigned: {ticket.assigned_agent}</span>}
            <span>Created {formatDate(ticket.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link to={`/support-tickets/${ticket.id}`} className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap no-underline">
            Open Ticket
          </Link>
          {linkedBug ? (
            <Link to="/bugs" className="text-[11px] text-emerald-400 hover:text-emerald-300 whitespace-nowrap no-underline">
              Open Bug
            </Link>
          ) : (
            <button
              type="button"
              onClick={onOpenCreateBug}
              className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer"
            >
              Create Project Bug
            </button>
          )}
          {linkedChange ? (
            <Link to="/change-requests" className="text-[11px] text-sky-400 hover:text-sky-300 whitespace-nowrap no-underline">
              Open Change
            </Link>
          ) : (
            <button
              type="button"
              onClick={onOpenCreateChange}
              className="text-[11px] text-sky-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
            >
              Create Change Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}