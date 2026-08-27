import type { AiGlobalSearchResult } from '@/pages/ai-operations/search/searchIndex';
import { RECORD_TYPE_ICONS } from '@/pages/ai-operations/search/searchUtils';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface ResultRowProps {
  result: AiGlobalSearchResult;
  active?: boolean;
  isFavourite: boolean;
  onOpen: (result: AiGlobalSearchResult) => void;
  onToggleFavourite: (result: AiGlobalSearchResult) => void;
  onMouseEnter?: () => void;
  id?: string;
}

export default function ResultRow({
  result,
  active = false,
  isFavourite,
  onOpen,
  onToggleFavourite,
  onMouseEnter,
  id,
}: ResultRowProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onClick={() => onOpen(result)}
      onMouseEnter={onMouseEnter}
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150 ${
        active ? 'bg-background-200/60' : 'hover:bg-background-200/40'
      }`}
    >
      <div className="w-8 h-8 shrink-0 rounded-md bg-background-100 border border-background-200/60 flex items-center justify-center text-foreground-500">
        <i className={`${RECORD_TYPE_ICONS[result.recordType]} text-sm w-4 h-4 flex items-center justify-center`}></i>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground-100 truncate">{result.title}</span>
          <span className="text-[10px] font-label text-foreground-600 font-mono shrink-0">{result.referenceId}</span>
        </div>
        <p className="text-[11px] font-label text-foreground-500 truncate mt-0.5">{result.subtitle}</p>
      </div>

      <StatusPill tone={result.statusTone} label={result.statusLabel} />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavourite(result);
        }}
        aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
          isFavourite ? 'text-accent-400' : 'text-foreground-600 hover:text-foreground-300'
        }`}
      >
        <i className={`${isFavourite ? 'ri-star-fill' : 'ri-star-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
      </button>
    </div>
  );
}