import { useState } from 'react';
import { isValidOrigin } from '../constants';

interface OriginEditorProps {
  origins: string[];
  onChange: (origins: string[]) => void;
  disabled?: boolean;
}

export default function OriginEditor({ origins, onChange, disabled }: OriginEditorProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const addOrigin = () => {
    const v = draft.trim();
    if (!v) return;
    if (!isValidOrigin(v)) {
      setError('Origins must be exact HTTPS origins — no wildcards, paths, queries or credentials.');
      return;
    }
    if (origins.includes(v)) {
      setError('That origin is already added.');
      return;
    }
    setError('');
    setDraft('');
    onChange([...origins, v]);
  };

  const removeOrigin = (o: string) => {
    onChange(origins.filter((x) => x !== o));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOrigin();
            }
          }}
          placeholder="https://www.example.com"
          className="flex-1 text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-accent-500/40 disabled:opacity-50"
          aria-label="Add allowed origin"
        />
        <button
          type="button"
          onClick={addOrigin}
          disabled={disabled}
          className="px-3 py-2 text-sm font-medium bg-background-200/70 hover:bg-background-300/70 text-foreground-200 rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {origins.length === 0 ? (
        <p className="text-xs text-foreground-500">No allowed origins yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {origins.map((o) => (
            <li
              key={o}
              className="flex items-center justify-between gap-3 bg-background-100 border border-background-200/60 rounded-md px-3 py-2"
            >
              <span className="text-sm text-foreground-100 break-all">{o}</span>
              <button
                type="button"
                onClick={() => removeOrigin(o)}
                disabled={disabled}
                className="w-8 h-8 flex items-center justify-center text-foreground-400 hover:text-red-400 transition-colors rounded cursor-pointer disabled:opacity-40 shrink-0"
                aria-label={`Remove ${o}`}
              >
                <i className="ri-close-line text-base w-4 h-4 flex items-center justify-center"></i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}