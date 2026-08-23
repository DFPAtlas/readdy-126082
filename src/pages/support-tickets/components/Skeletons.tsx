export function SummaryCardSkeleton() {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
      <div className="h-3 w-20 bg-background-200/70 rounded mb-3"></div>
      <div className="h-7 w-12 bg-background-200/70 rounded"></div>
    </div>
  );
}

export function TicketRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-background-200/40 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-background-200/70 shrink-0"></div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-2/3 bg-background-200/70 rounded"></div>
        <div className="h-3 w-1/3 bg-background-200/50 rounded"></div>
      </div>
      <div className="h-5 w-16 bg-background-200/70 rounded-full shrink-0"></div>
    </div>
  );
}

export default function Skeletons() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SummaryCardSkeleton key={i} />
        ))}
      </div>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
        <div className="h-9 bg-background-200/60 rounded-lg mb-3"></div>
        <div className="flex gap-3">
          <div className="h-9 w-32 bg-background-200/50 rounded-lg"></div>
          <div className="h-9 w-32 bg-background-200/50 rounded-lg"></div>
        </div>
      </div>
      <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <TicketRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}