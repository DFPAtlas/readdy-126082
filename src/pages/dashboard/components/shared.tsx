import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function SectionHeading({
  icon,
  title,
  action,
}: {
  icon: string;
  title: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
        <i className={`${icon} w-4 h-4 flex items-center justify-center text-foreground-400`}></i>
        {title}
      </h3>
      {action && (
        <Link
          to={action.to}
          className="text-xs text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap cursor-pointer"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Unavailable({ label = 'Data unavailable' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-foreground-500 bg-background-50 border border-background-200/40 rounded-md px-3 py-2">
      <i className="ri-information-line w-3.5 h-3.5 flex items-center justify-center"></i>
      <span>{label}</span>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-foreground-500">{children}</p>;
}

export function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-label whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}

export function Metric({
  label,
  value,
  tone = 'text-foreground-100',
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="bg-background-50 border border-background-200/50 rounded-md px-3 py-2 min-w-0">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide truncate whitespace-nowrap">
        {label}
      </p>
      <p className={`text-base font-heading font-semibold leading-tight truncate ${tone}`}>{value}</p>
    </div>
  );
}