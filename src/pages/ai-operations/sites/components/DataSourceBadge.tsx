// Shared data-source mode for the live registries (Sites, Agents, and later
// Runs/Approvals). The three states are identical across modules, so the badge
// is generic rather than tied to any single registry.
export type DataSourceMode = 'live' | 'demo' | 'error';

// Subtle status indicator showing whether a registry is reading live Supabase
// data, explicit demo data, or is currently unavailable. Uses an icon + label
// (never colour alone) so the state is always readable.
export default function DataSourceBadge({ mode }: { mode: DataSourceMode }) {
  if (mode === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
        <i className="ri-database-2-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
        Live Data
      </span>
    );
  }

  if (mode === 'demo') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
        <i className="ri-flask-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
        Demo Data
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
      <i className="ri-error-warning-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
      Unavailable
    </span>
  );
}