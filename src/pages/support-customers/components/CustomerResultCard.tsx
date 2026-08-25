import type { CustomerSearchResult } from '@/types/support-customers';
import { displayValue, formatShortId } from '../constants';

interface CustomerResultCardProps {
  result: CustomerSearchResult;
  onClick: () => void;
}

export default function CustomerResultCard({ result, onClick }: CustomerResultCardProps) {
  const isClient = result.entity_type === 'client';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-accent-500/40 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isClient ? (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground-50">
                {result.organisation_name ?? 'Unknown organisation'}
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400 rounded-full px-2 py-0.5 whitespace-nowrap">
                No portal account
              </span>
            </div>
          ) : (
            <p className="text-sm font-semibold text-foreground-50">{result.full_name ?? 'Unknown name'}</p>
          )}

          {isClient && result.company_name && (
            <p className="text-xs text-foreground-500 mt-0.5">{result.company_name}</p>
          )}
          {isClient && result.full_name && (
            <p className="text-xs text-foreground-400 mt-0.5">Contact: {result.full_name}</p>
          )}

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

          {!isClient && (
            <p className="text-xs text-foreground-500 mt-1">{displayValue(result.organisation_name)}</p>
          )}

          {isClient && result.status && (
            <p className="text-xs text-foreground-500 mt-1">
              <span className="text-foreground-600">Status:</span> {result.status}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right flex flex-col items-end gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-secondary-500/15 text-secondary-300 rounded-full px-2 py-0.5 whitespace-nowrap">
            {isClient ? 'Client / Organisation' : 'User Customer'}
          </span>
          {!isClient && (
            <span className="text-xs text-foreground-600 font-mono">ID: {formatShortId(result.customer_id)}</span>
          )}
        </div>
      </div>

      {result.products && !isClient && (
        <p className="text-xs text-foreground-600 mt-2">
          <span className="text-foreground-500">Products:</span> {result.products}
        </p>
      )}
    </button>
  );
}