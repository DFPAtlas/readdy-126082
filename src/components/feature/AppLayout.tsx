import { useState } from 'react';
import { NavLink, useNavigate, useSearchParams, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';

const navItems = [
  { to: '/dashboard', icon: 'ri-dashboard-3-line', label: 'Dashboard' },
  { to: '/projects', icon: 'ri-folder-3-line', label: 'Projects' },
  { to: '/ideas', icon: 'ri-lightbulb-line', label: 'Ideas' },
  { to: '/change-requests', icon: 'ri-git-pull-request-line', label: 'Change Requests' },
  { to: '/prompts', icon: 'ri-terminal-box-line', label: 'Prompts' },
  { to: '/bugs', icon: 'ri-bug-line', label: 'Bugs' },
  { to: '/notes', icon: 'ri-sticky-note-line', label: 'Notes' },
  { to: '/files-links', icon: 'ri-links-line', label: 'Files & Links' },
  { to: '/roadmap', icon: 'ri-road-map-line', label: 'Roadmap' },
  { to: '/build-process', icon: 'ri-list-check-3', label: 'Build Process' },
  { to: '/project-budget', icon: 'ri-money-pound-circle-line', label: 'Project Budget' },
  { to: '/system-status', icon: 'ri-pulse-line', label: 'System Status' },
  { to: '/activity-log', icon: 'ri-history-line', label: 'Activity' },
];

const uatNavItems = [
  { tab: 'register', icon: 'ri-global-line', label: 'UAT Projects' },
  { tab: 'changes', icon: 'ri-bug-line', label: 'Bug Reports' },
  { tab: 'page-review', icon: 'ri-file-check-line', label: 'Test Results' },
  { tab: 'link-checker', icon: 'ri-camera-line', label: 'Evidence' },
  { tab: 'image-manager', icon: 'ri-timer-line', label: 'Sessions' },
  { tab: 'uat-runs', icon: 'ri-test-tube-line', label: 'Test Runs' },
  { tab: 'approval', icon: 'ri-shield-check-line', label: 'Approvals' },
];

export default function AppLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'register';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const roleBadge = () => {
    const colors: Record<string, string> = { owner: 'bg-primary-500/15 text-primary-400', admin: 'bg-accent-500/15 text-accent-400', viewer: 'bg-secondary-500/15 text-secondary-300' };
    return (
      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded ${colors[auth.role ?? 'viewer']} whitespace-nowrap uppercase`}>
        {auth.role}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background-50 flex">
      {/* Sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[250px] bg-background-100 border-r border-background-200/60 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-background-200/60">
          <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center shrink-0">
            <i className="ri-radar-line text-background-950 text-lg w-5 h-5 flex items-center justify-center"></i>
          </div>
          <span className="font-heading font-semibold text-sm text-foreground-50 whitespace-nowrap">
            Footprint<span className="text-accent-400">CC</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-accent-500/10 text-accent-400 font-medium'
                    : 'text-foreground-400 hover:text-foreground-200 hover:bg-background-200/50'
                }`
              }
            >
              <i className={`${item.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
              {item.label}
            </NavLink>
          ))}

          {/* Website UAT Section */}
          <div className="pt-3 mt-3 border-t border-background-200/60">
            <p className="px-3 py-1 text-[10px] font-label text-foreground-600 uppercase tracking-widest whitespace-nowrap">Website UAT &amp; Changes</p>
          </div>
          {uatNavItems.map((item) => (
            <NavLink
              key={item.tab}
              to={`/admin/website-uat?tab=${item.tab}`}
              onClick={() => setSidebarOpen(false)}
              className={
                activeTab === item.tab
                  ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 whitespace-nowrap bg-accent-500/10 text-accent-400 font-medium'
                  : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 whitespace-nowrap text-foreground-400 hover:text-foreground-200 hover:bg-background-200/50'
              }
            >
              <i className={`${item.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-background-200/60 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-secondary-400 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-foreground-50">
                {auth.user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground-200 font-medium truncate">{auth.user?.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {roleBadge()}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-foreground-500 hover:text-foreground-200 transition-colors duration-150 w-full cursor-pointer"
          >
            <i className="ri-logout-box-line text-base w-4 h-4 flex items-center justify-center"></i>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-background-200/60 bg-background-50 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center text-foreground-300 hover:text-foreground-100 transition-colors cursor-pointer"
            onClick={() => setSidebarOpen(true)}
          >
            <i className="ri-menu-line text-xl"></i>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-sm text-foreground-500">
            <i className="ri-calendar-line w-4 h-4 flex items-center justify-center"></i>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer rounded-lg hover:bg-background-100">
              <i className="ri-notification-3-line text-lg w-5 h-5 flex items-center justify-center"></i>
            </button>
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer"
            >
              <i className="ri-logout-box-line text-base w-4 h-4 flex items-center justify-center"></i>
              <span className="whitespace-nowrap">Sign out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}