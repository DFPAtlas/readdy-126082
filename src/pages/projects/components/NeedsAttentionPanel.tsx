import { Link } from 'react-router-dom';
import type { PortfolioProject } from '../portfolioTypes';

export default function NeedsAttentionPanel({ items }: { items: PortfolioProject[] }) {
  if (items.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <SectionHeading icon="ri-alert-line" title="Needs Attention" />
        <p className="text-sm text-foreground-500">No projects currently require attention.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <SectionHeading icon="ri-alert-line" title={`Needs Attention (${items.length})`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((pp) => {
          const top = pp.attention[0];
          return (
            <Link
              key={pp.project.id}
              to={`/projects/${pp.project.project_slug}?section=${top.section}`}
              className="flex items-center gap-3 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" aria-hidden="true"></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-heading font-semibold text-foreground-100 truncate">
                  {pp.project.project_name}
                </p>
                <p className="text-xs text-red-400 truncate">{top.reason}</p>
              </div>
              <i className="ri-arrow-right-line text-foreground-500 w-4 h-4 flex items-center justify-center shrink-0"></i>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
      <i className={`${icon} w-4 h-4 flex items-center justify-center text-foreground-400`}></i>
      {title}
    </h3>
  );
}