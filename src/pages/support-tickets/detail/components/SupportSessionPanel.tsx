import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthGuard';
import { useTicketSessions, endSupportSession } from '@/pages/support-customers/hooks';
import {
  sessionStatusLabels,
  sessionStatusColors,
  formatSessionRemaining,
} from '@/pages/support-customers/constants';
import { formatFullDateTime } from '@/pages/support-tickets/constants';
import RevokeSessionModal from '@/pages/support-customers/components/RevokeSessionModal';
import type { SupportSession } from '@/types/support-customers';

interface SupportSessionPanelProps {
  ticketId: string;
  canStart: boolean;
  canRevoke: boolean;
  canStartSession: boolean;
  onStartSession: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

function remainingSeconds(session: SupportSession | null): number {
  if (!session?.expires_at) return 0;
  return Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
}

export default function SupportSessionPanel({
  ticketId,
  canStart,
  canRevoke,
  canStartSession,
  onStartSession,
  onToast,
}: SupportSessionPanelProps) {
  const navigate = useNavigate();
  const auth = useAuth();
  const { sessions, loading, error } = useTicketSessions(ticketId);
  const [revoke, setRevoke] = useState<SupportSession | null>(null);
  const [now, setNow] = useState(Date.now());

  // Ticks once a second to keep the remaining-time readout live.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const active = sessions.find((s) => s.status === 'active') ?? null;
  const previous = sessions.filter((s) => s.status !== 'active');
  const ownActive = active && active.requested_by === auth.user?.id;
  const remaining = remainingSeconds(active);

  const handleEnd = async () => {
    if (!active) return;
    const res = await endSupportSession(active.id);
    onToast(res.message, res.success ? 'success' : 'error');
  };

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-2">
          <i className="ri-eye-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Support Access
        </h2>
        {canStart && canStartSession && !active && (
          <button
            type="button"
            onClick={onStartSession}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-eye-line w-4 h-4 flex items-center justify-center"></i>
            Start Support Session
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 bg-background-200/50 rounded-lg animate-pulse"></div>
        </div>
      ) : error ? (
        <p className="text-sm text-red-400 py-1">{error}</p>
      ) : !active ? (
        <div className="py-6 text-center">
          <p className="text-sm text-foreground-500">No active support session.</p>
          {!canStartSession && (
            <p className="text-xs text-foreground-600 mt-1">
              Resolve the customer association before starting a support session.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-label font-semibold text-emerald-300 uppercase tracking-wider">
                Read-only session active
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-foreground-300">
              <p>
                Started by <span className="text-foreground-100">{active.requested_by_name ?? '—'}</span>
              </p>
              <p>
                Started <span className="text-foreground-100">{formatFullDateTime(active.started_at)}</span>
              </p>
              <p>
                Remaining{' '}
                <span className="font-mono text-foreground-100">{formatSessionRemaining(remaining)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
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
              {active && !ownActive && canRevoke && (
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
        </div>
      )}

      {previous.length > 0 && (
        <div className="mt-3 border-t border-background-200/50 pt-3">
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wider mb-1.5">
            Previous sessions
          </p>
          <div className="space-y-1.5">
            {previous.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 text-xs bg-background-50 border border-background-200/50 rounded-lg px-3 py-2"
              >
                <span className="text-foreground-500 font-mono">{s.id.slice(0, 8)}…</span>
                <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${sessionStatusColors[s.status]}`}>
                  {sessionStatusLabels[s.status]}
                </span>
                <span className="text-foreground-600 whitespace-nowrap">
                  {formatFullDateTime(s.created_at)}
                </span>
              </div>
            ))}
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