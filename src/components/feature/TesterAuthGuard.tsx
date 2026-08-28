import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import type { UatTester } from '@/pages/admin/website-uat/types';
import { classifyTesterStatus, type TesterAccessState } from '@/pages/account-uat/types';

interface TesterContextValue {
  tester: UatTester | null;
  accessState: TesterAccessState;
  loading: boolean;
  error: string;
  reload: () => void;
}

const TesterContext = createContext<TesterContextValue>({
  tester: null,
  accessState: 'loading',
  loading: true,
  error: '',
  reload: () => {},
});

export const useTester = () => useContext(TesterContext);

function StatusScreen({
  icon,
  title,
  message,
  onSignOut,
}: {
  icon: string;
  title: string;
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[440px] text-center">
        <div className="w-16 h-16 bg-background-200/60 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className={`${icon} text-foreground-400 text-3xl w-8 h-8 flex items-center justify-center`}></i>
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground-50 mb-3">{title}</h1>
        <p className="text-sm text-foreground-400 mb-8 leading-relaxed">{message}</p>
        <button
          onClick={onSignOut}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-colors whitespace-nowrap cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/**
 * Tester account guard. Unlike the Command Centre `AuthGuard`, this only
 * requires a signed-in Supabase user and resolves the tester's `uat_testers`
 * profile by `user_id`. It does NOT require an `internal_user_roles` entry,
 * so testers can reach their account area without being Command staff.
 *
 * Reads only the caller's own profile via the existing `uat_testers` select_own
 * RLS policy — no new RLS, no cross-tester exposure.
 */
export default function TesterAuthGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [tester, setTester] = useState<UatTester | null>(null);
  const [accessState, setAccessState] = useState<TesterAccessState>('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!auth.user) {
      setAccessState('not_signed_in');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: e } = await supabase
        .from('uat_testers')
        .select('*')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (e) throw e;
      if (!data) {
        setTester(null);
        setAccessState('not_a_tester');
        return;
      }
      setTester(data as UatTester);
      setAccessState(classifyTesterStatus(data.status));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAccessState('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth.loading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (loading || auth.loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-foreground-400">Loading your account...</span>
        </div>
      </div>
    );
  }

  if (accessState === 'error') {
    return (
      <StatusScreen
        icon="ri-error-warning-line"
        title="Something went wrong"
        message={error || 'Unable to load your tester account.'}
        onSignOut={signOut}
      />
    );
  }

  if (accessState === 'not_signed_in') return null;

  if (accessState === 'not_a_tester') {
    return (
      <StatusScreen
        icon="ri-user-add-line"
        title="Not registered as a tester"
        message="Your account is not registered as a UAT tester. If you believe this is a mistake, please contact support."
        onSignOut={signOut}
      />
    );
  }

  if (accessState === 'pending') {
    return (
      <StatusScreen
        icon="ri-time-line"
        title="Application under review"
        message="Your UAT tester application is still being reviewed. You'll be able to access the tester dashboard once it's approved."
        onSignOut={signOut}
      />
    );
  }

  if (accessState === 'suspended') {
    return (
      <StatusScreen
        icon="ri-forbid-2-line"
        title="Account suspended"
        message="Your tester account has been suspended. Please contact support for more information."
        onSignOut={signOut}
      />
    );
  }

  if (accessState === 'inactive') {
    return (
      <StatusScreen
        icon="ri-pause-circle-line"
        title="Account inactive"
        message="Your tester account is not currently active. Please contact support for more information."
        onSignOut={signOut}
      />
    );
  }

  return (
    <TesterContext.Provider value={{ tester, accessState, loading, error, reload: load }}>
      {children}
    </TesterContext.Provider>
  );
}