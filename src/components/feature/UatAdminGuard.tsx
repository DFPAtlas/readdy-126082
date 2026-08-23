import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';

type AccessState = 'loading' | 'allowed' | 'denied';

/**
 * Route guard for the Website UAT administration area.
 *
 * Command Centre roles map to UAT admin as follows:
 *   - owner  -> allowed (confirmed against the DB bridge)
 *   - admin  -> allowed (confirmed against the DB bridge)
 *   - viewer -> denied
 *   - no role -> denied (also caught earlier by AuthGuard)
 *
 * The final decision is DB-backed via `has_uat_admin_access()`, which in turn
 * delegates to `app_private.is_admin()` — never decided purely in the browser.
 */
export default function UatAdminGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [access, setAccess] = useState<AccessState>('loading');

  useEffect(() => {
    if (auth.loading) return;

    // Viewer and role-less accounts are denied outright — no DB round-trip needed.
    if (auth.role === 'viewer' || auth.role === null) {
      setAccess('denied');
      return;
    }

    // Owner/admin: confirm DB-backed UAT admin access before rendering.
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('has_uat_admin_access');
        if (cancelled) return;
        setAccess(error || data !== true ? 'denied' : 'allowed');
      } catch {
        if (!cancelled) setAccess('denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.loading, auth.role]);

  if (access === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-foreground-400">Checking access...</span>
        </div>
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-[420px] text-center">
          <div className="w-16 h-16 bg-accent-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-cross-line text-accent-400 text-3xl w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground-50 mb-3">Access denied</h1>
          <p className="text-sm text-foreground-400 mb-8 leading-relaxed">
            You do not have permission to access the Website UAT administration.
            Contact the Command Centre owner if you believe this is a mistake.
          </p>
          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            className="w-full bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}