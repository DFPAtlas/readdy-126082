import type { ReactNode } from 'react';

export default function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary-500/10 text-secondary-300">
            <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
          </div>
          <h2 className="text-base font-heading font-semibold text-foreground-100">{title}</h2>
        </div>
        {subtitle && <p className="text-sm text-foreground-500 mt-1.5 max-w-3xl">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}