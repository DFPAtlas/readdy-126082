import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTester } from '@/components/feature/TesterAuthGuard';

/**
 * Standalone layout for the tester account area. Deliberately does NOT use the
 * Command Centre `AppLayout` (which exposes internal nav/controls), keeping the
 * tester surface clean and free of admin functionality.
 */
export default function TesterLayout() {
  const { tester } = useTester();
  const navigate = useNavigate();
  const name = tester?.display_name || tester?.full_name || 'Tester';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background-50">
      <header className="sticky top-0 z-30 bg-background-50 border-b border-background-200/60">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent-500 rounded-lg flex items-center justify-center">
              <i className="ri-test-tube-line text-background-950 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div className="leading-tight">
              <p className="font-heading font-semibold text-sm text-foreground-50 whitespace-nowrap">UAT Tester</p>
              <p className="text-[11px] text-foreground-500 whitespace-nowrap">Digital Footprint</p>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink
              to="/account/uat"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  isActive ? 'bg-background-200/60 text-foreground-100 font-medium' : 'text-foreground-400 hover:text-foreground-200'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/uat"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  isActive ? 'bg-background-200/60 text-foreground-100 font-medium' : 'text-foreground-400 hover:text-foreground-200'
                }`
              }
            >
              Available Tests
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary-400 flex items-center justify-center">
                <span className="text-xs font-semibold text-foreground-50">{name.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm text-foreground-300 whitespace-nowrap">{name}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-logout-box-line text-base w-4 h-4 flex items-center justify-center"></i>
              <span className="whitespace-nowrap">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}