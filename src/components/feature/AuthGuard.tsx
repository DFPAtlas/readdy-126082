import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/permissions';

type MfaStatus = 'setup' | 'verify' | 'satisfied';

interface AuthState {
  loading: boolean;
  user: { id: string; email?: string } | null;
  role: Role | null;
  mfaStatus: MfaStatus | null;
}

interface AuthContextValue extends AuthState {
  refreshMfa: () => Promise<void>;
}

async function checkMfaStatus(): Promise<MfaStatus> {
  try {
    const [aalRes, factorsRes] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    // A verified factor is what separates "needs setup" from the rest. Reading the
    // factor list directly keeps this correct even when the session token still
    // carries a stale aal2 claim right after the last factor is unenrolled.
    const factors = factorsRes.data;
    if (!factorsRes.error && factors) {
      const hasVerified =
        (factors.totp ?? []).some((f) => f.status === 'verified') ||
        (factors.phone ?? []).some((f) => f.status === 'verified');
      if (!hasVerified) return 'setup';
    }

    if (aalRes.data?.currentLevel === 'aal2') return 'satisfied';
    if (aalRes.data?.nextLevel === 'aal2') return 'verify';
    return 'setup';
  } catch {
    return 'satisfied';
  }
}

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  user: null,
  role: null,
  mfaStatus: null,
  refreshMfa: async () => {},
});
export const useAuth = () => useContext(AuthContext);

export default function AuthGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [auth, setAuth] = useState<AuthState>({ loading: true, user: null, role: null, mfaStatus: null });

  useEffect(() => {
    let cancelled = false;

    const fetchRole = async (userId: string): Promise<AuthState['role']> => {
      try {
        const { data: roleData } = await supabase
          .from('internal_user_roles')
          .select('role, status')
          .eq('user_id', userId)
          .maybeSingle();

        // Disabled staff accounts are denied access (status !== 'active').
        if (roleData?.role && roleData?.status !== 'disabled') {
          return roleData.role as AuthState['role'];
        }

        // No role yet — attempt to accept a pending invitation. This is resolved
        // server-side (SECURITY DEFINER), never by the browser, and can only ever
        // grant a role that an owner already issued an invitation for.
        const { data: accepted, error: acceptError } = await supabase.rpc('accept_invitation');
        if (acceptError) return null;
        return (accepted as AuthState['role']) || null;
      } catch {
        return null;
      }
    };

    const applyUser = (user: { id: string; email?: string }) => {
      if (cancelled) return;
      setAuth({ loading: true, user, role: null, mfaStatus: null });
      Promise.all([fetchRole(user.id), checkMfaStatus()]).then(([role, mfaStatus]) => {
        if (!cancelled) setAuth({ loading: false, user, role, mfaStatus });
      });
    };

    const clearSession = () => {
      if (!cancelled) setAuth({ loading: false, user: null, role: null, mfaStatus: null });
    };

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Auth session error, clearing session:', error.message);
          await supabase.auth.signOut({ scope: 'local' });
          clearSession();
          return;
        }

        if (!session) {
          clearSession();
          return;
        }

        applyUser({ id: session.user.id, email: session.user.email });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('Failed to restore session, signing out:', message);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        clearSession();
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearSession();
        return;
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        setAuth((prev) => ({ ...prev, user: { id: session.user.id, email: session.user.email } }));
        return;
      }

      if (event === 'MFA_CHALLENGE_VERIFIED') {
        if (session) {
          setAuth((prev) => ({ ...prev, user: { id: session.user.id, email: session.user.email } }));
        }
        checkMfaStatus().then((mfaStatus) => {
          if (!cancelled) setAuth((prev) => ({ ...prev, mfaStatus }));
        });
        return;
      }

      if (session) {
        applyUser({ id: session.user.id, email: session.user.email });
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const refreshMfa = async () => {
    const mfaStatus = await checkMfaStatus();
    setAuth((prev) => ({ ...prev, mfaStatus }));
  };

  const publicPaths = ['/login', '/signup'];
  const mfaSetupPath = '/mfa/setup';
  const mfaVerifyPath = '/mfa/verify';
  const isPublic = publicPaths.includes(location.pathname);
  const isMfaSetup = location.pathname === mfaSetupPath;
  const isMfaVerify = location.pathname === mfaVerifyPath;

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user && !isPublic) {
      navigate('/login', { replace: true });
      return;
    }
    if (auth.user && isPublic) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (auth.user && auth.role !== null) {
      if (auth.mfaStatus === 'setup' && !isMfaSetup) {
        navigate('/mfa/setup', { replace: true });
        return;
      }
      if (auth.mfaStatus === 'verify' && !isMfaVerify) {
        navigate('/mfa/verify', { replace: true });
        return;
      }
      if (auth.mfaStatus === 'satisfied' && (isMfaSetup || isMfaVerify)) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [auth.loading, auth.user, auth.role, auth.mfaStatus, isPublic, isMfaSetup, isMfaVerify, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-foreground-400">Loading command centre...</span>
        </div>
      </div>
    );
  }

  if (!auth.user && !isPublic) return null;
  if (auth.user && isPublic) return null;

  // Authenticated but no Command Centre role — deny access (invite-only).
  if (auth.user && auth.role === null) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <div className="w-full max-w-[420px] text-center">
          <div className="w-16 h-16 bg-accent-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-cross-line text-accent-400 text-3xl w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground-50 mb-3">No access</h1>
          <p className="text-sm text-foreground-400 mb-8 leading-relaxed">
            Your account does not have access to the DFP Command Centre. If you believe
            this is a mistake, contact the Command Centre owner.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // MFA is mandatory — hold the user on the right screen until aal2 is satisfied.
  if (auth.user && auth.mfaStatus === 'setup' && !isMfaSetup) return null;
  if (auth.user && auth.mfaStatus === 'verify' && !isMfaVerify) return null;
  if (auth.user && auth.mfaStatus === 'satisfied' && (isMfaSetup || isMfaVerify)) return null;

  return (
    <AuthContext.Provider value={{ ...auth, refreshMfa }}>
      {children}
    </AuthContext.Provider>
  );
}