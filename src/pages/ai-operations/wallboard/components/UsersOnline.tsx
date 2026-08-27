import { getUsersOnline } from '@/pages/ai-operations/wallboard/selectors';

export default function UsersOnline() {
  const data = getUsersOnline();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Users Online</h3>
        <span className="text-2xl font-heading font-bold text-foreground-100 tabular-nums">{data.total}</span>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        {data.sites.map((s) => (
          <div key={s.site} className="flex items-center justify-between text-sm">
            <span className="text-foreground-400">{s.site}</span>
            <span className="text-foreground-200 font-medium tabular-nums">{s.users}</span>
          </div>
        ))}
        <p className="text-[10px] font-label text-foreground-600 pt-1.5 border-t border-background-200/40">
          Demo — live analytics connection not configured
        </p>
      </div>
    </section>
  );
}