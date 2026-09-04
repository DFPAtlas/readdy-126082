import { useEffect, useState } from 'react';
import { FIRST_PROJECT_CHECKLIST, FIRST_PROJECT_CHECKLIST_STORAGE_KEY } from '../helpContent';

export default function FirstProjectChecklist() {
  const [checked, setChecked] = useState<boolean[]>(() => {
    try {
      const raw = localStorage.getItem(FIRST_PROJECT_CHECKLIST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return FIRST_PROJECT_CHECKLIST.map((_, i) => Boolean(parsed[i]));
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    return FIRST_PROJECT_CHECKLIST.map(() => false);
  });
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(FIRST_PROJECT_CHECKLIST_STORAGE_KEY, JSON.stringify(checked));
    } catch {
      /* ignore write failure */
    }
  }, [checked]);

  const toggle = (i: number) => {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const reset = () => {
    setChecked(FIRST_PROJECT_CHECKLIST.map(() => false));
    setConfirmReset(false);
  };

  const completedCount = checked.filter(Boolean).length;
  const allDone = completedCount === FIRST_PROJECT_CHECKLIST.length;

  return (
    <section id="first-project-checklist" className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-checkbox-circle-line text-sm w-4 h-4 flex items-center justify-center"></i>
          </span>
          <div>
            <h2 className="text-base font-heading font-semibold text-foreground-50">Your First Project Checklist</h2>
            <p className="text-xs text-foreground-500 mt-0.5">A training aid to help you run your first project end to end.</p>
          </div>
        </div>
        <span className="text-xs text-foreground-500 whitespace-nowrap">{completedCount}/{FIRST_PROJECT_CHECKLIST.length} complete</span>
      </div>

      <div className="mt-4">
        <div className="h-1.5 bg-background-200/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-500 rounded-full transition-all"
            style={{ width: `${Math.round((completedCount / FIRST_PROJECT_CHECKLIST.length) * 100)}%` }}
          ></div>
        </div>
      </div>

      <ul className="mt-4 space-y-1">
        {FIRST_PROJECT_CHECKLIST.map((item, i) => (
          <li key={item}>
            <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-background-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="w-4 h-4 rounded border-background-300/60 accent-accent-500 cursor-pointer shrink-0"
              />
              <span className={`text-sm ${checked[i] ? 'text-foreground-500 line-through' : 'text-foreground-200'}`}>{item}</span>
              {checked[i] && (
                <i className="ri-check-line text-accent-400 text-sm w-4 h-4 flex items-center justify-center shrink-0 ml-auto"></i>
              )}
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 pt-4 border-t border-background-200/40 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-foreground-600">Progress is saved on this device only and does not change any project records.</p>
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground-300">Clear all progress?</span>
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium bg-accent-500 text-background-950 px-3 py-1.5 rounded-full hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer"
            >
              Confirm reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="text-xs text-foreground-500 hover:text-foreground-200 px-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-xs text-foreground-500 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
          >
            <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Reset checklist
          </button>
        )}
      </div>

      {allDone && (
        <div className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
          <i className="ri-check-double-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
          <p className="text-xs text-emerald-200">All first-project steps complete — great work.</p>
        </div>
      )}
    </section>
  );
}