// Shared "unavailable" placeholder for wallboard sections whose live data
// source is not connected or failed to load. Keeps the visual language
// consistent across every section and is distinct from a genuine "zero".

export default function UnavailableState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <i className="ri-cloud-off-line text-foreground-600 text-xl w-6 h-6 flex items-center justify-center"></i>
      <p className="text-sm font-label text-foreground-400">Unavailable</p>
      {label && <p className="text-[11px] font-label text-foreground-600 max-w-[240px]">{label}</p>}
    </div>
  );
}