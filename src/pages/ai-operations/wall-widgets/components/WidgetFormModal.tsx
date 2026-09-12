import { useEffect, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { AiSiteRow } from '@/lib/ai-operations/types';
import {
  WALL_WIDGET_BRAND_COLORS,
  type WallWidgetBrandColor,
  type WallWidgetConfigRow,
  type WallWidgetConfigUpsertInput,
} from '@/lib/ai-operations/wallWidgetConfig';
import { BRAND_SWATCH, BRAND_COLOR_LABELS, deriveInitials } from '@/pages/ai-operations/wall-widgets/constants';

interface WidgetFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Existing widget to edit, or null to add a new one. */
  widget: WallWidgetConfigRow | null;
  /** Sites that do not yet have a widget (add mode only). */
  availableSites: AiSiteRow[];
  onSave: (input: WallWidgetConfigUpsertInput) => Promise<{ error: string | null }>;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const labelCls = 'block text-xs font-label text-foreground-500 mb-1';

export default function WidgetFormModal({ open, onClose, widget, availableSites, onSave }: WidgetFormModalProps) {
  const [siteId, setSiteId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [initials, setInitials] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [brandColor, setBrandColor] = useState<WallWidgetBrandColor>('cyan');
  const [visibleOnWall, setVisibleOnWall] = useState(true);
  const [visibleInAutonomous, setVisibleInAutonomous] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSubmitting(false);
    if (widget) {
      setSiteId(widget.site_id);
      setDisplayName(widget.display_name);
      setInitials(widget.initials);
      setSubtitle(widget.subtitle ?? '');
      setBrandColor(widget.brand_color as WallWidgetBrandColor);
      setVisibleOnWall(widget.visible_on_wall);
      setVisibleInAutonomous(widget.visible_in_autonomous);
    } else {
      setSiteId('');
      setDisplayName('');
      setInitials('');
      setSubtitle('');
      setBrandColor('cyan');
      setVisibleOnWall(true);
      setVisibleInAutonomous(true);
    }
  }, [open, widget]);

  const handleSiteChange = (id: string) => {
    setSiteId(id);
    const site = availableSites.find((s) => s.id === id);
    if (site) {
      setDisplayName(site.name);
      setInitials(deriveInitials(site.name));
    }
  };

  const handleSave = async () => {
    if (!siteId) {
      setError('Choose a site.');
      return;
    }
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (!initials.trim()) {
      setError('Initials are required.');
      return;
    }
    if (initials.trim().length > 4) {
      setError('Initials must be 4 characters or fewer.');
      return;
    }

    setSubmitting(true);
    const { error: saveError } = await onSave({
      site_id: siteId,
      display_name: displayName.trim(),
      initials: initials.trim().toUpperCase(),
      subtitle: subtitle.trim() || null,
      brand_color: brandColor,
      visible_on_wall: visibleOnWall,
      visible_in_autonomous: visibleInAutonomous,
    });
    if (saveError) {
      setError(saveError);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
  };

  const saveLabel = widget ? 'Update Widget' : 'Add Widget';

  return (
    <Modal open={open} onClose={onClose} title={widget ? 'Edit Widget' : 'Add Widget'} className="max-w-xl">
      <div className="p-5 space-y-4">
        {widget ? (
          <div className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Site</p>
            <p className="text-sm text-foreground-200">{widget.display_name}</p>
          </div>
        ) : (
          <div>
            <label className={labelCls}>Site *</label>
            <select value={siteId} onChange={(e) => handleSiteChange(e.target.value)} className={`${inputCls} cursor-pointer`}>
              <option value="">Select a site…</option>
              {availableSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.site_key})
                </option>
              ))}
            </select>
            {availableSites.length === 0 && (
              <p className="text-[11px] font-label text-foreground-600 mt-1">Every registered site already has a widget.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Display name *</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. The Forge" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Initials * (4 max)</label>
            <input type="text" value={initials} maxLength={4} onChange={(e) => setInitials(e.target.value.toUpperCase())} placeholder="TF" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Subtitle</label>
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. AI research & reasoning" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Brand colour</label>
          <div className="flex items-center gap-2 flex-wrap">
            {WALL_WIDGET_BRAND_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBrandColor(c)}
                title={BRAND_COLOR_LABELS[c]}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 ${brandColor === c ? 'ring-2 ring-accent-400' : 'opacity-70 hover:opacity-100'}`}
              >
                <span className={`${BRAND_SWATCH[c]} w-6 h-6 rounded-full`}></span>
              </button>
            ))}
          </div>
          <p className="text-[11px] font-label text-foreground-600 mt-1">Selected: {BRAND_COLOR_LABELS[brandColor]}</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={visibleOnWall} onChange={(e) => setVisibleOnWall(e.target.checked)} className="accent-accent-500 w-4 h-4 cursor-pointer" />
            Show on Operations Wall
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={visibleInAutonomous} onChange={(e) => setVisibleInAutonomous(e.target.checked)} className="accent-accent-500 w-4 h-4 cursor-pointer" />
            Show in Autonomous Operations
          </label>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 disabled:opacity-60 disabled:cursor-not-allowed text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            {submitting && <i className="ri-loader-4-line text-sm w-4 h-4 flex items-center justify-center animate-spin"></i>}
            {submitting ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}