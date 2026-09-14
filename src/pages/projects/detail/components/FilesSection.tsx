import { FileLink, fileTypeIcons } from '../types';
import { EmptyState } from './BugsSection';

export default function FilesSection({ fileLinks }: { fileLinks: FileLink[] }) {
  if (fileLinks.length === 0) {
    return (
      <EmptyState
        icon="ri-links-line"
        title="No files or links yet"
        message="No files or links have been linked to this project."
      />
    );
  }

  const grouped = fileLinks.reduce<Record<string, FileLink[]>>((acc, fl) => {
    const key = fl.type || 'link';
    if (!acc[key]) acc[key] = [];
    acc[key].push(fl);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-4">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-2">
            <i className={`${fileTypeIcons[type] ?? 'ri-link'} w-3.5 h-3.5 flex items-center justify-center text-foreground-400`}></i>
            <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">{type}</span>
            <span className="text-[10px] text-foreground-600">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((fl) => (
              <a
                key={fl.id}
                href={fl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-background-50 border border-background-200/60 rounded-lg p-3 hover:border-accent-500/30 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <i className={`${fileTypeIcons[fl.type] ?? 'ri-link'} text-accent-400 w-3.5 h-3.5 flex items-center justify-center`}></i>
                  <h4 className="text-sm font-medium text-foreground-100 group-hover:text-accent-400 transition-colors line-clamp-1">{fl.name}</h4>
                </div>
                {fl.description && <p className="text-xs text-foreground-500 line-clamp-2 ml-5">{fl.description}</p>}
                {fl.category && (
                  <div className="mt-2 ml-5">
                    <span className="text-[10px] text-foreground-600 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{fl.category}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}