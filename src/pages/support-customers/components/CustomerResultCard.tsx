import type { CustomerSearchResult } from '@/types/support-customers';
import { displayValue, formatShortId } from '../constants';

interface CustomerResultCardProps {
  result: CustomerSearchResult;
  onClick: () => void;
}

export default function CustomerResultCard({ result, onClick }: CustomerResultCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-accent-500/40 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-50">{result.full_name ?? 'Unknown name'}</p>
          {result.email ? (
            <a
              href={`mailto:${result.email}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-accent-400 hover:text-accent-300 underline decoration-accent-400/40 underline-offset-2 break-all"
            >
              {result.email}
            </a>
          ) : (
            <p className="text-xs text-foreground-600">No email</p>
          )}
          <p className="text-xs text-foreground-500 mt-1">{displayValue(result.organisation_name)}</p>
        </div>
        <span className="text-xs text-foreground-600 font-mono shrink-0 whitespace-nowrap">
          ID: {formatShortId(result.customer_id)}
        </span>
      </div>
      {result.products && (
        <p className="text-xs text-foreground-600 mt-2">
          <span className="text-foreground-500">Products:</span> {result.products}
        </p>
      )}
    </button>
  );
}