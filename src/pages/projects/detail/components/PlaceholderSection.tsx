import { Link } from 'react-router-dom';
import { SectionKey } from '../types';

interface PlaceholderSectionProps {
  section: Exclude<SectionKey, 'overview' | 'bugs' | 'changes' | 'activity' | 'files' | 'infrastructure'>;
}

export default function PlaceholderSection({ section }: PlaceholderSectionProps) {
  const config = placeholderConfig[section];

  return (
    <div className="px-6 py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
        <i className={`${config.icon} text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center`}></i>
      </div>
      <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">{config.heading}</h3>
      <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">{config.message}</p>
      <Link
        to={config.to}
        className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
      >
        <i className={`${config.buttonIcon} w-4 h-4 flex items-center justify-center`}></i>
        {config.buttonLabel}
      </Link>
    </div>
  );
}

const placeholderConfig: Record<
  Exclude<SectionKey, 'overview' | 'bugs' | 'changes' | 'activity' | 'files' | 'infrastructure'>,
  { heading: string; message: string; to: string; buttonLabel: string; icon: string; buttonIcon: string }
> = {
  build: {
    heading: 'Project Build',
    message: "Build Process integration will show this project's active checklist, stage, blockers and launch readiness.",
    to: '/build-process',
    buttonLabel: 'Open Global Build Process',
    icon: 'ri-hammer-line',
    buttonIcon: 'ri-arrow-right-line',
  },
  github: {
    heading: 'GitHub',
    message: 'No project repository has been connected yet.',
    to: '/github',
    buttonLabel: 'Open GitHub Repositories',
    icon: 'ri-github-line',
    buttonIcon: 'ri-arrow-right-line',
  },
  ai: {
    heading: 'AI Operations',
    message: 'Project AI Operations will show the master agent, sub-agents, runs, alerts and runtime health associated with this project.',
    to: '/ai-operations',
    buttonLabel: 'Open AI Operations',
    icon: 'ri-robot-2-line',
    buttonIcon: 'ri-arrow-right-line',
  },
  uat: {
    heading: 'UAT',
    message: 'Project UAT integration will show test runs, defects, evidence and deployment approval.',
    to: '/admin/website-uat',
    buttonLabel: 'Open UAT Dashboard',
    icon: 'ri-clipboard-line',
    buttonIcon: 'ri-arrow-right-line',
  },
  budget: {
    heading: 'Project Budget',
    message: 'Project-specific costs, recurring costs and forecasts will appear here.',
    to: '/project-budget',
    buttonLabel: 'Open Project Budget',
    icon: 'ri-money-pound-circle-line',
    buttonIcon: 'ri-arrow-right-line',
  },
  support: {
    heading: 'Support',
    message: 'Support tickets and incidents associated with this project will appear here.',
    to: '/support-tickets',
    buttonLabel: 'Open Support Tickets',
    icon: 'ri-lifebuoy-line',
    buttonIcon: 'ri-arrow-right-line',
  },
  monitoring: {
    heading: 'Monitoring',
    message: 'Monitoring source not linked to this project.',
    to: '/system-status',
    buttonLabel: 'Open System Status',
    icon: 'ri-pulse-line',
    buttonIcon: 'ri-arrow-right-line',
  },
};