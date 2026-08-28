import { useTester } from '@/components/feature/TesterAuthGuard';
import { useTesterUat } from '../hooks';
import Marketplace from '../components/Marketplace';

/**
 * Tester-facing Available Tests marketplace at `/uat`. Reuses the exact same
 * data hook and publication filter (`isMarketplaceVisible`) as the account
 * dashboard's Available tab — no duplicated query logic, no copied job data.
 */
export default function UatMarketplace() {
  const { tester } = useTester();
  const data = useTesterUat(tester?.id ?? null);

  if (data.loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-background-300/40 rounded"></div>
          <div className="h-3 w-72 bg-background-300/40 rounded"></div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-background-300/30 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-foreground-400 text-sm mb-4">{data.error}</p>
        <button
          onClick={data.reload}
          className="bg-accent-500 text-background-950 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground-50">Available UAT Tests</h1>
        <p className="text-sm text-foreground-500 mt-1">
          Browse paid UAT opportunities and find tests that match your setup.
        </p>
      </div>

      <Marketplace jobs={data.availableJobs} projectById={data.projectById} tester={tester} />
    </div>
  );
}