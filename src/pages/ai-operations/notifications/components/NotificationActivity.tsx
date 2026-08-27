import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { NotificationEvent } from '@/pages/ai-operations/types';
import {
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
  NOTIFICATION_CHANNEL_LABELS,
  ACKNOWLEDGEMENT_STATE,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import Modal from '@/components/base/Modal';
import { useNotifications } from '@/pages/ai-operations/notifications/NotificationsContext';

function relatedLink(event: NotificationEvent): { to: string; label: string } | null {
  if (!event.relatedRecordId) return null;
  switch (event.relatedRecordType) {
    case 'alert':
      return { to: `/ai-operations/alerts/${event.relatedRecordId}`, label: 'Open Alert' };
    case 'approval':
      return { to: `/ai-operations/approvals/${event.relatedRecordId}`, label: 'Open Approval' };
    case 'run':
      return { to: `/ai-operations/runs/${event.relatedRecordId}`, label: 'Open Run' };
    case 'policy':
      return { to: `/ai-operations/security/policies/${event.relatedRecordId}`, label: 'Open Policy' };
    case 'orchestration':
      return { to: `/ai-operations/orchestrator/${event.relatedRecordId}`, label: 'Open Orchestration' };
    case 'budget':
      return { to: '/ai-operations/costs', label: 'Open Budgets' };
    case 'agent':
      return { to: `/ai-operations/agents/${event.relatedRecordId}`, label: 'Open Agent' };
    case 'site':
      return { to: `/ai-operations/sites/${event.relatedRecordId}`, label: 'Open Site' };
    case 'model':
      return { to: `/ai-operations/models/${event.relatedRecordId}`, label: 'Open Model' };
    default:
      return null;
  }
}

export default function NotificationActivity({ events }: { events: NotificationEvent[] }) {
  const [selected, setSelected] = useState<NotificationEvent | null>(null);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Notification Activity</h3>
        <span className="text-[11px] font-label text-foreground-600">{events.length} events</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Event</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Channel</th>
              <th className="px-4 py-2.5 font-medium">Recipient Team</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Related Record</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const prio = NOTIFICATION_PRIORITY[e.priority];
              const status = NOTIFICATION_STATUS[e.status];
              const link = relatedLink(e);
              return (
                <tr key={e.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{e.time.replace('2026-08-25 ', '').replace('2026-08-24 ', '')}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap max-w-[140px] truncate">{e.source}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.siteName}</td>
                  <td className="px-4 py-3 text-foreground-200 max-w-[220px] truncate">{e.event}</td>
                  <td className="px-4 py-3"><StatusPill tone={prio.tone} label={prio.label} /></td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{NOTIFICATION_CHANNEL_LABELS[e.channel]}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap max-w-[150px] truncate">{e.recipientTeam}</td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3">
                    {link ? (
                      <Link to={link.to} className="text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap">
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(e)}
                      className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open
                      <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {events.map((e) => {
          const prio = NOTIFICATION_PRIORITY[e.priority];
          const status = NOTIFICATION_STATUS[e.status];
          return (
            <button key={e.id} onClick={() => setSelected(e)} className="block w-full text-left px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground-100">{e.event}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{e.siteName} · {e.time.replace('2026-08-25 ', '').replace('2026-08-24 ', '')}</p>
                </div>
                <StatusPill tone={prio.tone} label={prio.label} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] font-label text-foreground-500 flex-wrap">
                <StatusPill tone={status.tone} label={status.label} />
                <span>{e.recipientTeam}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Notification detail drawer */}
      {selected && (
        <Modal open onClose={() => setSelected(null)} title="Notification Detail">
          <NotificationDetail event={selected} />
        </Modal>
      )}
    </section>
  );
}

function NotificationDetail({ event }: { event: NotificationEvent }) {
  const { acknowledgeEvent } = useNotifications();
  const [ackError, setAckError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackDone, setAckDone] = useState(false);
  const prio = NOTIFICATION_PRIORITY[event.priority];
  const status = NOTIFICATION_STATUS[event.status];
  const ack = ACKNOWLEDGEMENT_STATE[event.acknowledgement];
  const link = relatedLink(event);

  const canAck = event.acknowledgement === 'awaiting' || event.acknowledgement === 'missed';

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    setAckError(null);
    const result = await acknowledgeEvent(event.id);
    setAcknowledging(false);
    if (result.error) {
      setAckError(result.error);
    } else {
      setAckDone(true);
    }
  };

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Notification ID', value: <span className="font-mono text-xs">{event.id}</span> },
    { label: 'Event', value: event.event },
    { label: 'Source', value: event.source },
    { label: 'Site', value: event.siteName },
    { label: 'Priority', value: <StatusPill tone={prio.tone} label={prio.label} /> },
    { label: 'Channel', value: NOTIFICATION_CHANNEL_LABELS[event.channel] },
    { label: 'Recipient Team', value: event.recipientTeam },
    { label: 'Status', value: <StatusPill tone={status.tone} label={status.label} /> },
    { label: 'Created', value: event.time },
    { label: 'Acknowledgement', value: <StatusPill tone={ack.tone} label={ack.label} /> },
    { label: 'Acknowledgement Deadline', value: event.acknowledgementDeadline || '—' },
    { label: 'Acknowledged By', value: event.acknowledgedByTeam || '—' },
    { label: 'Escalation Level', value: `Level ${event.escalationLevel}` },
    { label: 'Rule', value: event.ruleId ? <Link to={`/ai-operations/notifications/rules/${event.ruleId}`} className="text-accent-400 hover:text-accent-300 font-mono text-xs cursor-pointer">{event.ruleId}</Link> : '—' },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1">
            <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{r.label}</span>
            <span className="text-sm text-foreground-100">{r.value}</span>
          </div>
        ))}
      </div>

      {link && (
        <div className="pt-3 border-t border-background-200/60">
          <Link
            to={link.to}
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            {link.label}
            <i className="ri-arrow-right-line w-4 h-4 flex items-center justify-center"></i>
          </Link>
        </div>
      )}

      {canAck && !ackDone && (
        <div className="pt-3 border-t border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] font-label text-foreground-500">
            Acknowledgement is configuration metadata only — no message is sent.
          </p>
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <i className="ri-check-line text-sm w-4 h-4 flex items-center justify-center"></i>
            {acknowledging ? 'Acknowledging…' : 'Acknowledge'}
          </button>
        </div>
      )}

      {ackDone && (
        <p className="text-[11px] font-label text-emerald-400 pt-3 border-t border-background-200/60">
          Acknowledged — no message was sent.
        </p>
      )}

      {ackError && (
        <p className="text-[11px] font-label text-red-400">{ackError}</p>
      )}

      <p className="text-[11px] font-label text-foreground-600">
        Notification events are operational history only — no message was delivered and no private contact information is stored.
      </p>
    </div>
  );
}