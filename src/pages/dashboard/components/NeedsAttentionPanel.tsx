import { Link } from 'react-router-dom';
import type { NeedsAttentionItem } from '../executiveTypes';
import { SectionHeading, EmptyNote } from './shared';

const SEVERITY_DOT: Record<NeedsAttentionItem['severity'], string> = {
  Critical: 'bg-red-400',
  High: 'bg-orange-400',
  Medium: 'bg-amber-400',
  Low: 'bg-foreground-400',
};

const SEVERITY_TEXT: Record<NeedsAttentionItem['severity'], string> = {
  Critical: 'text-red-400',
  High: 'text-orange-400',
  Medium: 'text-amber-400',
  Low: 'text-foreground-500',
};

export default function NeedsAttentionPanel({ items }: { items: NeedsAttentionItem[] }) {
  return (
    <section className="bg-background-100 border border-red-500/20 rounded-lg p-5">
      <SectionHeading icon="ri-alert-line" title={`Needs Attention (${items.length})`} />

      {items.length === 0 ? (
        <EmptyNote>No high-value issues require attention right now.</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((it) => (
            <Item key={it.key} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}

function Item({ item }: { item: NeedsAttentionItem }) {
  const body = (
    <>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${SEVERITY_DOT[item.severity]}`} aria-hidden="true"></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{item.projectName}</p>
          <span className="text-[10px] text-foreground-600 whitespace-nowrap shrink-0">{item.ageLabel}</span>
        </div>
        <p className={`text-xs truncate ${SEVERITY_TEXT[item.severity]}`}>{item.issue}</p>
        <p className="text-[10px] text-foreground-500 mt-0.5 truncate">
          {item.source} · {item.severity}
        </p>
      </div>
    </>
  );

  if (item.deepLink) {
    return (
      <Link
        to={item.deepLink.to}
        className="flex items-start gap-3 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
      >
        {body}
        <i className="ri-arrow-right-s-line text-foreground-500 w-4 h-4 flex items-center justify-center shrink-0 mt-1"></i>
      </Link>
    );
  }

  return (
    <div className="flex items-start gap-3 bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
      {body}
    </div>
  );
}