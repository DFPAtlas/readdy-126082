import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface AuthState {
  loading: boolean;
  user: { id: string; email?: string } | null;
  role: 'owner' | 'admin' | 'viewer' | null;
}

const AuthContext = createContext<AuthState>({ loading: true, user: null, role: null });
export const useAuth = () => useContext(AuthContext);

export default function AuthGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [auth, setAuth] = useState<AuthState>({ loading: true, user: null, role: null });

  useEffect(() => {
    let cancelled = false;

    const clearSession = () => {
      if (!cancelled) setAuth({ loading: false, user: null, role: null });
    };

    const fetchRole = (userId: string) => {
      supabase
        .from('internal_user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data: roleData }) => {
          if (!cancelled) setAuth(prev => ({ ...prev, role: (roleData?.role as AuthState['role']) ?? null }));
        })
        .catch(() => {
          if (!cancelled) setAuth(prev => ({ ...prev, role: null }));
        });
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

        if (!cancelled) {
          setAuth({
            loading: false,
            user: { id: session.user.id, email: session.user.email },
            role: null,
          });
          fetchRole(session.user.id);
        }
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
        setAuth({ loading: false, user: null, role: null });
        return;
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        setAuth(prev => ({ ...prev, user: { id: session.user.id, email: session.user.email } }));
        fetchRole(session.user.id);
        return;
      }

      if (session) {
        setAuth(prev => ({ ...prev, user: { id: session.user.id, email: session.user.email } }));
        fetchRole(session.user.id);
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const publicPaths = ['/login', '/signup'];
  const isPublic = publicPaths.includes(location.pathname);

  useEffect(() => {
    if (!auth.loading && !auth.user && !isPublic) {
      navigate('/login', { replace: true });
    }
    if (!auth.loading && auth.user && isPublic) {
      navigate('/dashboard', { replace: true });
    }
  }, [auth.loading, auth.user, isPublic, navigate]);

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

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}