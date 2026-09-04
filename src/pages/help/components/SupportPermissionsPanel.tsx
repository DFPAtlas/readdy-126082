import { useAuth } from '@/components/feature/AuthGuard';
import { hasPermission, ROLE_LABELS, type Role } from '@/lib/permissions';
import { SUPPORT_CAPABILITIES, type SupportCapability } from '../helpContent';

type CapabilityState = 'available' | 'read-only' | 'restricted';

const STATE_META: Record<CapabilityState, { label: string; cls: string; icon: string }> = {
  available: { label: 'Available', cls: 'bg-emerald-500/15 text-emerald-400', icon: 'ri-check-line' },
  'read-only': { label: 'Read only', cls: 'bg-amber-500/15 text-amber-400', icon: 'ri-eye-line' },
  restricted: { label: 'Restricted', cls: 'bg-red-500/15 text-red-400', icon: 'ri-lock-line' },
};

function resolveState(cap: SupportCapability, role: Role | null): CapabilityState {
  if (hasPermission(role, cap.permission)) return 'available';
  if (hasPermission(role, cap.viewPermission)) return 'read-only';
  return 'restricted';
}

export default function SupportPermissionsPanel() {
  const auth = useAuth();
  const role = (auth.role ?? null) as Role | null;

  return (
    <section id="support-permissions-panel" className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
          <i className="ri-shield-keyhole-line text-sm w-4 h-4 flex items-center justify-center"></i>
        </span>
        <div>
          <h2 className="text-base font-heading font-semibold text-foreground-50">Your Support Permissions</h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            Your role: <span className="text-foreground-300">{role ? ROLE_LABELS[role] : 'Not signed in'}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SUPPORT_CAPABILITIES.map((cap) => {
          const state = resolveState(cap, role);
          const meta = STATE_META[state];
          return (
            <div
              key={cap.id}
              className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/50 rounded-lg px-3 py-2.5"
            >
              <span className="text-sm text-foreground-200 min-w-0">{cap.label}</span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${meta.cls}`}
              >
                <i className={`${meta.icon} w-3 h-3 flex items-center justify-center`}></i>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 mt-4 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
        <i className="ri-alert-line text-amber-400 text-sm w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
        <p className="text-xs text-amber-200 leading-relaxed">
          If a control is unavailable, escalate the ticket to an authorised member of staff. Never attempt
          to bypass the role restriction.
        </p>
      </div>
    </section>
  );
}