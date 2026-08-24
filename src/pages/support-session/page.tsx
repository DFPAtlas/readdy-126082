import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSupportSessionView, endSupportSession, logSessionSectionView } from '@/pages/support-customers/hooks';
import { displayValue, formatSessionRemaining } from '@/pages/support-customers/constants';
import { formatFullDateTime, formatRelative } from '@/pages/support-tickets/constants';
import type { SupportSessionView } from '@/types/support-customers';

type SectionKey = 'account' | 'subscription' | 'activity' | 'context';

const sections: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'account', label: 'Account', icon: 'ri-user-line' },
  { key: 'subscription', label: 'Subscription', icon: 'ri-money-pound-circle-line' },
  { key: 'activity', label: 'Activity', icon: 'ri-pulse-line' },
  { key: 'context', label: 'Support Context', icon: 'ri-stethoscope-line' },
];

function friendlyError(msg: string): string {
  if (msg.includes('SESSION_EXPIRED')) return 'This support session has expired.';
  if (msg.includes('SESSION_NOT_ACTIVE')) return 'This support session is no longer active.';
  if (msg.includes('ACCESS_DENIED')) return 'You do not have access to this support session.';
  if (msg.includes('SESSION_NOT_FOUND')) return 'Support session not found.';
  if (msg.includes('FORBIDDEN')) return 'You do not have permission to view this support session.';
  return msg;
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-background-200/60">
        <i className={`${icon} text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
        <h2 className="text-xs font-label font-semibold text-foreground-400 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-sm text-foreground-200 text-right break-words min-w-0">{children}</span>
    </div>
  );
}

export default function SupportSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { view, loading, error } = useSupportSessionView(sessionId);
  const [section, setSection] = useState<SectionKey>('account');
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (sessionId) logSessionSectionView(sessionId, section);
  }, [sessionId, section]);

  const remaining = view ? Math.max(0, Math.floor((new Date(view.session.expires_at ?? '').getTime() - now) / 1000)) : 0;

  const handleEnd = useCallback(async () => {
    if (!sessionId) return;
    setEnding(true);
    await endSupportSession(sessionId);
    setEnding(false);
    const target = view?.session.ticket_id
      ? `/support-tickets/${view.session.ticket_id}`
      : view?.session.customer_id
        ? `/customers/${view.session.customer_id}`
        : '/support-tickets';
    navigate(target, { replace: true });
  }, [sessionId, view, navigate]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-background-100 rounded-lg animate-pulse"></div>
        <div className="h-40 bg-background-100 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="max-w-lg mx-auto pt-10">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-red-400 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h1 className="text-lg font-heading font-semibold text-foreground-100 mb-2">
            Support session unavailable
          </h1>
          <p className="text-sm text-foreground-400">{error ? friendlyError(error) : 'No session data.'}</p>
          <Link
            to="/support-tickets"
            className="inline-flex items-center gap-2 mt-5 bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
            Return to tickets
          </Link>
        </div>
      </div>
    );
  }

  const s = view.session;

  return (
    <div className="space-y-5">
      {/* Persistent read-only banner */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6">
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <i className="ri-eye-line text-emerald-300 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-label font-semibold text-emerald-300 uppercase tracking-wider">
                DFP Support Session — Read Only
              </p>
              <p className="text-sm text-foreground-100 mt-0.5 break-words">
                Viewing <span className="font-semibold">{displayValue(s.customer_name)}</span>
                {s.site_name && <span className="text-foreground-400"> — {s.site_name}</span>}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-foreground-500">
                {s.ticket_number && <span className="font-mono">{s.ticket_number}</span>}
                <span className="inline-flex items-center gap-1">
                  <i className="ri-timer-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  Expires in{' '}
                  <span className="font-mono text-foreground-200">{formatSessionRemaining(remaining)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {s.ticket_id && (
              <Link
                to={`/support-tickets/${s.ticket_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-arrow-left-line w-3.5 h-3.5 flex items-center justify-center"></i>
                Return to Ticket
              </Link>
            )}
            <button
              type="button"
              onClick={handleEnd}
              disabled={ending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500 hover:bg-red-400 text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              <i className="ri-stop-circle-line w-3.5 h-3.5 flex items-center justify-center"></i>
              {ending ? 'Ending…' : 'End Session'}
            </button>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-background-100 rounded-full max-w-full overflow-x-auto">
        {sections.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSection(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap ${
              section === t.key
                ? 'bg-accent-500 text-background-950 font-semibold'
                : 'text-foreground-400 hover:text-foreground-200'
            }`}
          >
            <i className={`${t.icon} w-4 h-4 flex items-center justify-center`}></i>
            {t.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      {section === 'account' && (
        <Card title="Account" icon="ri-user-line">
          {view.profile ? (
            <div className="divide-y divide-background-200/40">
              <Row label="Name">{displayValue(view.profile.name)}</Row>
              <Row label="Email">{displayValue(view.profile.email)}</Row>
              <Row label="Status">
                <span className="capitalize">{displayValue(view.profile.status)}</span>
              </Row>
              <Row label="Role">{displayValue(view.profile.role)}</Row>
              <Row label="Company">{displayValue(view.profile.company)}</Row>
              <Row label="Created">
                {view.profile.created_at ? formatFullDateTime(view.profile.created_at) : 'Not available'}
              </Row>
            </div>
          ) : (
            <p className="text-sm text-foreground-500 py-4 text-center">No profile data available for this account.</p>
          )}
        </Card>
      )}

      {section === 'subscription' && (
        <Card title="Subscription" icon="ri-money-pound-circle-line">
          {view.subscription ? (
            <div className="divide-y divide-background-200/40">
              <Row label="Plan">{displayValue(view.subscription.name)}</Row>
              <Row label="Status">
                <span className="capitalize">{displayValue(view.subscription.status)}</span>
              </Row>
              <Row label="Amount">
                {view.subscription.amount != null
                  ? `${view.subscription.currency ?? ''} ${view.subscription.amount}`.trim()
                  : 'Not available'}
              </Row>
              <Row label="Billing">{displayValue(view.subscription.interval)}</Row>
              <Row label="Cycle">{displayValue(view.subscription.billing_cycle)}</Row>
              <Row label="Next Billing">
                {view.subscription.next_billing_date
                  ? formatFullDateTime(view.subscription.next_billing_date)
                  : 'Not available'}
              </Row>
              <Row label="Payment Method">{displayValue(view.subscription.payment_method)}</Row>
            </div>
          ) : (
            <p className="text-sm text-foreground-500 py-4 text-center">No subscription data available.</p>
          )}
        </Card>
      )}

      {section === 'activity' && (
        <Card title="Recent Activity" icon="ri-pulse-line">
          {view.site ? (
            <div className="divide-y divide-background-200/40">
              <Row label="Site">{displayValue(view.site.name)}</Row>
              <Row label="Domain">{displayValue(view.site.domain)}</Row>
              <Row label="Status">
                {view.site.is_active === true ? 'Active' : view.site.is_active === false ? 'Inactive' : 'Not available'}
              </Row>
            </div>
          ) : (
            <p className="text-sm text-foreground-500 py-2 text-center">No site data available.</p>
          )}

          <div className="mt-4">
            <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wider mb-2">
              Recent support tickets
            </p>
            {view.recent_tickets.length === 0 ? (
              <p className="text-sm text-foreground-500">No recent support tickets.</p>
            ) : (
              <div className="space-y-1.5">
                {view.recent_tickets.map((t) => (
                  <div
                    key={t.ticket_number}
                    className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/50 rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-accent-400">{t.ticket_number}</span>
                      <p className="text-foreground-200 truncate">{t.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] capitalize text-foreground-500">{t.status}</span>
                      <span className="text-xs text-foreground-600 whitespace-nowrap">
                        {formatRelative(t.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {section === 'context' && (
        <Card title="Support Context" icon="ri-stethoscope-line">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-background-50 border border-background-200/50 rounded-lg p-4">
              <p className="text-xs font-label text-foreground-500 uppercase tracking-wider">Diagnostics</p>
              <p className="text-2xl font-heading font-semibold text-foreground-100 mt-1">{view.diagnostics_count}</p>
              <p className="text-xs text-foreground-600 mt-1">diagnostic runs on record</p>
            </div>
            <div className="bg-background-50 border border-background-200/50 rounded-lg p-4">
              <p className="text-xs font-label text-foreground-500 uppercase tracking-wider">Repairs</p>
              <p className="text-2xl font-heading font-semibold text-foreground-100 mt-1">{view.repairs_count}</p>
              <p className="text-xs text-foreground-600 mt-1">repair actions on record</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Link
              to={s.ticket_id ? `/support-tickets/${s.ticket_id}` : `/customers/${s.customer_id ?? ''}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-stethoscope-line w-3.5 h-3.5 flex items-center justify-center"></i>
              View Diagnostics
            </Link>
            <Link
              to={s.ticket_id ? `/support-tickets/${s.ticket_id}` : `/customers/${s.customer_id ?? ''}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-tools-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Request Repair
            </Link>
          </div>

          <div className="mt-4 bg-background-50 border border-background-200/50 rounded-lg px-3 py-2.5">
            <p className="text-xs text-foreground-500">
              <span className="font-semibold text-foreground-300">Read-only.</span> Any account change must go
              through the human-approved repair workflow — never from this view.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}