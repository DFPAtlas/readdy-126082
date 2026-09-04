import { useEffect, useState } from 'react';
import {
  WALLBOARD_VIEWS,
  WALLBOARD_SETTINGS_BOUNDS,
  type WallboardSettings,
  type WallboardViewDef,
  type WallboardClockFormat,
} from '@/pages/ai-operations/wallboard/wallboardSettings';

interface WallboardSettingsPanelProps {
  open: boolean;
  settings: WallboardSettings;
  onSave: (next: WallboardSettings) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function WallboardSettingsPanel({
  open,
  settings,
  onSave,
  onReset,
  onClose,
}: WallboardSettingsPanelProps) {
  const [draft, setDraft] = useState<WallboardSettings>(settings);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setConfirmReset(false);
    }
  }, [open, settings]);

  if (!open) return null;

  const enabledIds = draft.enabledViews;
  const enabledViews = enabledIds
    .map((id) => WALLBOARD_VIEWS.find((v) => v.id === id))
    .filter((v): v is WallboardViewDef => v != null);
  const disabledViews = WALLBOARD_VIEWS.filter((v) => !enabledIds.includes(v.id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...enabledIds];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft({ ...draft, enabledViews: next });
  };

  const toggleView = (id: string, enable: boolean) => {
    const next = enable ? [...enabledIds, id] : enabledIds.filter((x) => x !== id);
    setDraft({ ...draft, enabledViews: next });
  };

  const patch = (p: Partial<WallboardSettings>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-background-200/60 bg-background-100 text-foreground-50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-background-200/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent-500 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-settings-3-line text-background-950 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div>
              <h2 className="text-base font-heading font-bold text-foreground-50 leading-none whitespace-nowrap">
                Wallboard Settings
              </h2>
              <p className="text-[11px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">
                Display behaviour only · stored on this device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-500 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <i className="ri-close-line w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* View management */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wider">
                Rotation views
              </h3>
              <span className="text-[11px] font-label text-foreground-600">{enabledViews.length} enabled</span>
            </div>
            <p className="text-[11px] font-label text-foreground-600 mb-3">
              Incident Mode always overrides rotation when critical incidents occur and cannot be disabled.
            </p>

            <div className="space-y-1.5">
              {enabledViews.map((v, i) => (
                <ViewRow
                  key={v.id}
                  view={v}
                  enabled
                  isFirst={i === 0}
                  isLast={i === enabledViews.length - 1}
                  onToggle={() => toggleView(v.id, false)}
                  onMoveUp={() => move(i, -1)}
                  onMoveDown={() => move(i, 1)}
                />
              ))}
              {disabledViews.map((v) => (
                <ViewRow
                  key={v.id}
                  view={v}
                  enabled={false}
                  isFirst={false}
                  isLast={false}
                  onToggle={() => toggleView(v.id, true)}
                />
              ))}
            </div>
          </section>

          {/* Timing */}
          <section>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wider mb-3">
              Timing
            </h3>
            <div className="space-y-3">
              <ToggleRow
                label="Rotation enabled"
                hint="Auto-cycle through enabled views"
                checked={draft.rotationEnabled}
                onChange={(v) => patch({ rotationEnabled: v })}
              />
              {draft.rotationEnabled && (
                <IntervalField
                  label="Rotation interval"
                  hint={`${WALLBOARD_SETTINGS_BOUNDS.rotationInterval.min}–${WALLBOARD_SETTINGS_BOUNDS.rotationInterval.max}s`}
                  value={draft.rotationInterval}
                  min={WALLBOARD_SETTINGS_BOUNDS.rotationInterval.min}
                  max={WALLBOARD_SETTINGS_BOUNDS.rotationInterval.max}
                  step={5}
                  onChange={(n) => patch({ rotationInterval: n })}
                />
              )}
              <IntervalField
                label="Data refresh"
                hint="0 = off · 15–300s"
                value={draft.refreshInterval}
                min={0}
                max={WALLBOARD_SETTINGS_BOUNDS.refreshInterval.max}
                step={15}
                allowZero
                onChange={(n) => patch({ refreshInterval: n })}
              />
              <IntervalField
                label="Weather refresh"
                hint="5–60 min (in seconds)"
                value={draft.weatherInterval}
                min={WALLBOARD_SETTINGS_BOUNDS.weatherInterval.min}
                max={WALLBOARD_SETTINGS_BOUNDS.weatherInterval.max}
                step={60}
                onChange={(n) => patch({ weatherInterval: n })}
              />
            </div>
          </section>

          {/* Display */}
          <section>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wider mb-3">
              Display
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-label text-foreground-200">Clock format</p>
                  <p className="text-[11px] font-label text-foreground-600">12-hour or 24-hour</p>
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-label bg-background-200/60 rounded-md p-1">
                  {(['24h', '12h'] as WallboardClockFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => patch({ clockFormat: f })}
                      className={`px-3 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                        draft.clockFormat === f
                          ? 'bg-accent-500 text-background-950 font-semibold'
                          : 'text-foreground-400 hover:text-foreground-100'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow
                label="Show secondary metrics"
                hint="Runtime connectivity & local-path detail chips in the status bar"
                checked={draft.showSecondaryMetrics}
                onChange={(v) => patch({ showSecondaryMetrics: v })}
              />
              <ToggleRow
                label="Start in focus mode"
                hint="Open the wallboard in the condensed focus layout"
                checked={draft.focusModeDefault}
                onChange={(v) => patch({ focusModeDefault: v })}
              />
              <ToggleRow
                label="Fullscreen preference"
                hint="Stored preference only — enter/exit fullscreen via the header button"
                checked={draft.fullscreenPreference}
                onChange={(v) => patch({ fullscreenPreference: v })}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-background-200/60">
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-label text-amber-400">Reset display settings only?</span>
              <button
                onClick={onReset}
                className="inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-background-50 bg-red-500 border-red-500 hover:bg-red-600"
              >
                Confirm reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-foreground-300 bg-background-200/60 border-background-300/60 hover:border-background-300/60"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-foreground-300 bg-background-200/60 border-background-300/60 hover:border-background-300/60"
            >
              <i className="ri-restart-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Reset to defaults
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-foreground-300 bg-background-200/60 border-background-300/60 hover:border-background-300/60"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(draft)}
              className="inline-flex items-center gap-2 text-xs font-label rounded-md px-4 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-background-50 bg-accent-500 border-accent-500 hover:bg-accent-600"
            >
              <i className="ri-check-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewRow({
  view,
  enabled,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  view: WallboardViewDef;
  enabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
        enabled
          ? 'border-background-200/60 bg-background-200/40'
          : 'border-background-200/40 bg-background-100 opacity-70'
      }`}
    >
      <span className="flex-1 text-sm font-label text-foreground-100 whitespace-nowrap overflow-hidden text-ellipsis">
        {view.label}
      </span>

      {enabled && (
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-7 h-7 flex items-center justify-center rounded text-foreground-400 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Move ${view.label} up`}
          >
            <i className="ri-arrow-up-s-line w-4 h-4 flex items-center justify-center"></i>
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="w-7 h-7 flex items-center justify-center rounded text-foreground-400 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Move ${view.label} down`}
          >
            <i className="ri-arrow-down-s-line w-4 h-4 flex items-center justify-center"></i>
          </button>
        </div>
      )}

      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 text-[11px] font-label rounded-md px-2.5 py-1 border transition-colors cursor-pointer whitespace-nowrap ${
          enabled
            ? 'text-accent-400 bg-accent-500/10 border-accent-500/25 hover:bg-accent-500/20'
            : 'text-foreground-400 bg-background-200/60 border-background-300/60 hover:border-background-300/60'
        }`}
      >
        <i className={`${enabled ? 'ri-eye-line' : 'ri-eye-off-line'} text-xs w-3.5 h-3.5 flex items-center justify-center`}></i>
        {enabled ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-label text-foreground-200">{label}</p>
        <p className="text-[11px] font-label text-foreground-600">{hint}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
          checked ? 'bg-accent-500' : 'bg-background-300/60'
        }`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-background-50 transition-all ${
            checked ? 'left-[22px]' : 'left-[2px]'
          }`}
        ></span>
      </button>
    </div>
  );
}

function IntervalField({
  label,
  hint,
  value,
  min,
  max,
  step,
  allowZero = false,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  allowZero?: boolean;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    let n = Number(text);
    if (!Number.isFinite(n)) n = value;
    n = Math.round(n);
    if (allowZero && n === 0) {
      setText('0');
      onChange(0);
      return;
    }
    n = Math.min(max, Math.max(min, n));
    setText(String(n));
    onChange(n);
  };

  const bump = (delta: number) => {
    const cur = Number(text);
    const base = Number.isFinite(cur) ? cur : value;
    let n = base + delta;
    if (allowZero && n < min) n = 0;
    n = Math.min(max, Math.max(allowZero ? 0 : min, n));
    setText(String(n));
    onChange(n);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-label text-foreground-200">{label}</p>
        <p className="text-[11px] font-label text-foreground-600">{hint}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => bump(-step)}
          className="w-8 h-8 flex items-center justify-center rounded-md border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer"
          aria-label={`Decrease ${label}`}
        >
          <i className="ri-subtract-line w-4 h-4 flex items-center justify-center"></i>
        </button>
        <input
          type="number"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          min={allowZero ? 0 : min}
          max={max}
          className="w-20 h-8 rounded-md border border-background-300/60 bg-background-200/40 px-2 text-sm font-label text-foreground-50 text-center tabular-nums outline-none focus:border-accent-500/50"
          aria-label={label}
        />
        <span className="text-[11px] font-label text-foreground-600 w-3">s</span>
        <button
          onClick={() => bump(step)}
          className="w-8 h-8 flex items-center justify-center rounded-md border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer"
          aria-label={`Increase ${label}`}
        >
          <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
        </button>
      </div>
    </div>
  );
}