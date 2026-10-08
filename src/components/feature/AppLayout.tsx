import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useSearchParams, useLocation, useNavigationType, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import { useUnreadTicketCount } from '@/pages/support-tickets/hooks';
import { hasPermission, ROLE_BADGE_COLORS, ROLE_LABELS, type Role } from '@/lib/permissions';
import { SearchProvider } from '@/pages/ai-operations/search/SearchContext';
import { GroupLiveDataProvider } from '@/pages/ai-operations/live/groupLiveDataStore';
import CommandPalette from '@/pages/ai-operations/search/components/CommandPalette';
import SearchTrigger from '@/pages/ai-operations/search/components/SearchTrigger';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  ownerAdminOnly?: boolean;
}

const navItems: NavItem[] = [
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
  { to: '/ai-operations/wallboard', icon: 'ri-radar-line', label: 'Operations Wall' },
  { to: '/ai-operations/wall-widgets', icon: 'ri-layout-grid-line', label: 'Wall Widgets', ownerAdminOnly: true },
  { to: '/ai-operations/agent-deployment', icon: 'ri-rocket-2-line', label: 'Agent Deployment', ownerAdminOnly: true },
  { to: '/activity-log', icon: 'ri-history-line', label: 'Activity' },
  { to: '/github', icon: 'ri-github-fill', label: 'GitHub' },
  { to: '/ai-operations', icon: 'ri-robot-2-line', label: 'AI Operations' },
  { to: '/help', icon: 'ri-question-line', label: 'Help Centre' },
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

type GroupItem = NavItem & { permission?: 'support.metrics.view' | 'staff.manage' | 'support.knowledge.view' | 'support.integrations.manage'; tab?: string };
type NavigationGroup = { id: string; label: string; icon: string; items: GroupItem[] };

// Every existing destination remains available; grouping does not change access checks.
const navigationGroups: NavigationGroup[] = [
  { id: 'overview', label: 'Overview', icon: 'ri-dashboard-3-line', items: [
    navItems[0], navItems[15], navItems[11],
  ] },
  { id: 'projects', label: 'Projects & Development', icon: 'ri-folder-3-line', items: [
    ...navItems.slice(1, 11), navItems[16],
  ] },
  { id: 'uat', label: 'UAT & Testing', icon: 'ri-test-tube-line', items:
    uatNavItems.map((item) => ({ ...item, to: '/admin/website-uat', ownerAdminOnly: true })),
  },
  { id: 'ai', label: 'AI & Infrastructure', icon: 'ri-robot-2-line', items: [
    navItems[12], navItems[13], navItems[14], navItems[17],
  ] },
  { id: 'support', label: 'Commercial & Support', icon: 'ri-customer-service-2-line', items: [
    { to: '/support-tickets', icon: 'ri-ticket-2-line', label: 'Support Tickets' },
    { to: '/customers', icon: 'ri-user-search-line', label: 'Customers' },
    { to: '/support-repairs', icon: 'ri-tools-line', label: 'Support Repairs' },
    { to: '/support-tickets/reports', icon: 'ri-bar-chart-2-line', label: 'Support Analytics', permission: 'support.metrics.view' },
    { to: '/support-teams', icon: 'ri-group-2-line', label: 'Support Teams', permission: 'staff.manage' },
    { to: '/support-routing', icon: 'ri-git-branch-line', label: 'Routing Rules', permission: 'staff.manage' },
    { to: '/support-knowledge', icon: 'ri-book-open-line', label: 'Knowledge Base', permission: 'support.knowledge.view' },
    { to: '/admin/support-integrations', icon: 'ri-plug-2-line', label: 'Support Integrations', permission: 'support.integrations.manage' },
  ] },
  { id: 'admin', label: 'Administration', icon: 'ri-settings-3-line', items: [
    { to: '/security', icon: 'ri-shield-keyhole-line', label: 'Security' },
    { to: '/team', icon: 'ri-team-line', label: 'Team & Access', permission: 'staff.manage' },
    navItems[18],
  ] },
];

export default function AppLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'register';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    overview: true,
    projects: false,
    uat: false,
    ai: false,
    support: false,
    admin: false,
  }));
  const unreadTickets = useUnreadTicketCount();
  // Open the relevant group when navigating directly or via browser history.
  useEffect(() => {
    const match = navigationGroups.find((group) => group.items.some((item) =>
      item.tab
        ? location.pathname === '/admin/website-uat'
        : location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to + '/'))
    ));
    if (match) setOpenGroups((prev) => prev[match.id] ? prev : { ...prev, [match.id]: true });
  }, [location.pathname]);
  const mainRef = useRef<HTMLElement>(null);
  const scrollPositions = useRef<Map<string, number>>(new Map());

  // Save the current scroll position before leaving a page, keyed by its location.
  useEffect(() => {
    const key = location.key;
    return () => {
      scrollPositions.current.set(key, mainRef.current?.scrollTop ?? 0);
    };
  }, [location.key]);

  // On fresh navigation (link click) snap to top; on back/forward restore the saved spot.
  useEffect(() => {
    if (navigationType === 'POP') {
      const saved = scrollPositions.current.get(location.key);
      requestAnimationFrame(() => {
        mainRef.current?.scrollTo({ top: saved ?? 0 });
        window.scrollTo({ top: 0 });
      });
    } else {
      mainRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [location.key, navigationType]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const roleBadge = () => {
    const role = (auth.role ?? 'viewer') as Role;
    return (
      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded ${ROLE_BADGE_COLORS[role]} whitespace-nowrap uppercase`}>
        {ROLE_LABELS[role]}
      </span>
    );
  };

  return (
    <GroupLiveDataProvider>
    <SearchProvider>
    <div className="min-h-screen bg-background-50 flex">
      {/* Sidebar backdrop (mobile only) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${sidebarCollapsed ? 'lg:w-[60px]' : 'lg:w-[250px]'} w-[250px] bg-background-100 border-r border-background-200/60`}>
        <div className={`h-16 flex items-center gap-2.5 px-5 border-b border-background-200/60 ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center shrink-0">
            <i className="ri-radar-line text-background-950 text-lg w-5 h-5 flex items-center justify-center"></i>
          </div>
          <span className={`font-heading font-semibold text-sm text-foreground-50 whitespace-nowrap ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            Footprint<span className="text-accent-400">CC</span>
          </span>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {navigationGroups.map((group) => {
            const visibleItems = group.items.filter((item) =>
              (!item.ownerAdminOnly || auth.role === 'owner' || auth.role === 'admin') &&
              (!item.permission || hasPermission(auth.role, item.permission))
            );
            if (visibleItems.length === 0) return null;
            const expanded = openGroups[group.id] ?? false;
            const active = visibleItems.some((item) =>
              item.tab
                ? location.pathname === '/admin/website-uat' && activeTab === item.tab
                : location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to + '/'))
            );
            return (
              <div key={group.id}>
                <button type="button"
                  aria-expanded={expanded}
                  aria-controls={`nav-group-${group.id}`}
                  title={sidebarCollapsed ? group.label : undefined}
                  onClick={() => {
                    if (sidebarCollapsed) setSidebarCollapsed(false);
                    setOpenGroups((prev) => ({ ...prev, [group.id]: !expanded }));
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors ${active ? 'text-accent-400' : 'text-foreground-400 hover:text-foreground-200 hover:bg-background-200/50'} ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
                >
                  <i className={`${group.icon} text-base w-4 h-4 shrink-0`} aria-hidden="true" />
                  <span className={`flex-1 font-medium ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{group.label}</span>
                  <i className={`ri-arrow-down-s-line text-base transition-transform ${expanded ? 'rotate-180' : ''} ${sidebarCollapsed ? 'lg:hidden' : ''}`} aria-hidden="true" />
                </button>
                {expanded && (
                  <div id={`nav-group-${group.id}`} className={`mt-1 space-y-0.5 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                    {visibleItems.map((item) => (
                      <NavLink key={item.tab ?? item.to}
                        to={item.tab ? `/admin/website-uat?tab=${item.tab}` : item.to}
                        onClick={() => setSidebarOpen(false)}
                        title={item.label}
                        className={() => {
                          const selected = item.tab
                            ? location.pathname === '/admin/website-uat' && activeTab === item.tab
                            : location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to + '/'));
                          return `flex items-center gap-3 rounded-lg text-sm pl-7 pr-3 py-2 transition-colors ${selected ? 'bg-accent-500/10 text-accent-400 font-medium' : 'text-foreground-400 hover:text-foreground-200 hover:bg-background-200/50'}`;
                        }}
                      >
                        <i className={`${item.icon} text-base w-4 h-4 shrink-0`} aria-hidden="true" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.to === '/support-tickets' && unreadTickets > 0 && (
                          <span aria-label={`${unreadTickets} unread tickets`} className="text-[10px] font-semibold bg-accent-500 text-background-950 rounded-full px-1.5 py-0.5">
                            {unreadTickets > 99 ? '99+' : unreadTickets}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className={`border-t border-background-200/60 p-4 ${sidebarCollapsed ? 'lg:flex lg:flex-col lg:items-center lg:px-2' : ''}`}>
          <div className={`flex items-center gap-3 mb-3 ${sidebarCollapsed ? 'lg:flex-col lg:gap-1' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-secondary-400 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-foreground-50">
                {auth.user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm text-foreground-200 font-medium truncate">{auth.user?.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {roleBadge()}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 text-sm text-foreground-500 hover:text-foreground-200 transition-colors duration-150 w-full cursor-pointer ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
            title={sidebarCollapsed ? 'Sign out' : undefined}
          >
            <i className="ri-logout-box-line text-base w-4 h-4 flex items-center justify-center"></i>
            <span className={`${sidebarCollapsed ? 'lg:hidden' : ''}`}>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-background-200/60 bg-background-50 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button
              className="lg:hidden w-9 h-9 flex items-center justify-center text-foreground-300 hover:text-foreground-100 transition-colors cursor-pointer"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="ri-menu-line text-xl"></i>
            </button>

            {/* Desktop sidebar toggle */}
            <button
              className="hidden lg:flex w-9 h-9 items-center justify-center text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer rounded-lg hover:bg-background-100"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <i className={`ri-${sidebarCollapsed ? 'side-bar-line' : 'side-bar-fill'} text-lg w-5 h-5 flex items-center justify-center`}></i>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-sm text-foreground-500">
            <i className="ri-calendar-line w-4 h-4 flex items-center justify-center"></i>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

          <div className="flex items-center gap-3">
            <SearchTrigger />
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

        <main ref={mainRef} className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>

      {/* Global AI Operations command palette */}
      <CommandPalette />
    </SearchProvider>
    </GroupLiveDataProvider>
  );
}