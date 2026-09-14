import { SectionKey } from '../types';

interface NavItem {
  key: SectionKey;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
  { key: 'build', label: 'Build', icon: 'ri-hammer-line' },
  { key: 'github', label: 'GitHub', icon: 'ri-github-line' },
  { key: 'infrastructure', label: 'Infrastructure', icon: 'ri-server-line' },
  { key: 'ai', label: 'AI Ops', icon: 'ri-robot-2-line' },
  { key: 'uat', label: 'UAT', icon: 'ri-clipboard-line' },
  { key: 'bugs', label: 'Bugs', icon: 'ri-bug-line' },
  { key: 'changes', label: 'Changes', icon: 'ri-git-pull-request-line' },
  { key: 'budget', label: 'Budget', icon: 'ri-money-pound-circle-line' },
  { key: 'support', label: 'Support', icon: 'ri-lifebuoy-line' },
  { key: 'monitoring', label: 'Monitoring', icon: 'ri-pulse-line' },
  { key: 'launch', label: 'Launch', icon: 'ri-rocket-2-line' },
  { key: 'deployment', label: 'Deployment', icon: 'ri-send-plane-line' },
  { key: 'operations', label: 'Operations', icon: 'ri-settings-3-line' },
  { key: 'activity', label: 'Activity', icon: 'ri-history-line' },
  { key: 'files', label: 'Files', icon: 'ri-links-line' },
];

interface CommandNavProps {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  counts: Partial<Record<SectionKey, number>>;
}

export default function CommandNav({ active, onSelect, counts }: CommandNavProps) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-1.5">
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = active === item.key;
          const count = counts[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-label transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-accent-500/10 text-accent-400 font-semibold'
                  : 'text-foreground-500 hover:text-foreground-300 hover:bg-background-200/40'
              }`}
            >
              <i className={`${item.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
              {item.label}
              {count != null && count > 0 && (
                <span className="text-[10px] opacity-60">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}