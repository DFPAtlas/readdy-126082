import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import {
  getWallWidgetConfigs,
  createWallWidgetConfig,
  updateWallWidgetConfig,
  type WallWidgetConfigRow,
  type WallWidgetConfigUpsertInput,
} from '@/lib/ai-operations/wallWidgetConfig';
import { getAiSites } from '@/lib/ai-operations';
import type { AiSiteRow } from '@/lib/ai-operations/types';
import WidgetFormModal from '@/pages/ai-operations/wall-widgets/components/WidgetFormModal';
import { BRAND_SWATCH } from '@/pages/ai-operations/wall-widgets/constants';

function ToggleSwitch({ checked, label, disabled, onChange }: { checked: boolean; label: string; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      title={label}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-label transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
        checked
          ? 'bg-accent-500/15 text-accent-400 border border-accent-500/30'
          : 'bg-background-50 text-foreground-600 border border-background-300/60'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${checked ? 'bg-accent-400' : 'bg-foreground-600'}`}></span>
      {label}
    </button>
  );
}

export default function WallWidgetsPage() {
  const { role } = useAuth();
  const isAuthorised = role === 'owner' || role === 'admin';

  const [widgets, setWidgets] = useState<WallWidgetConfigRow[]>([]);
  const [sites, setSites] = useState<AiSiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WallWidgetConfigRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wRes, sRes] = await Promise.all([getWallWidgetConfigs(), getAiSites()]);
      if (wRes.error) throw new Error(wRes.error);
      if (sRes.error) throw new Error(sRes.error);
      setWidgets(wRes.data ?? []);
      setSites(sRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load widget configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const siteById = useMemo(() => {
    const map = new Map<string, AiSiteRow>();
    for (const s of sites) map.set(s.id, s);
    return map;
  }, [sites]);

  const availableSites = useMemo(() => {
    const widgetSiteIds = new Set(widgets.map((w) => w.site_id));
    return sites.filter((s) => !widgetSiteIds.has(s.id));
  }, [sites, widgets]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (w: WallWidgetConfigRow) => {
    setEditing(w);
    setModalOpen(true);
  };

  const handleSave = async (input: WallWidgetConfigUpsertInput): Promise<{ error: string | null }> => {
    if (editing) {
      const { error: e } = await updateWallWidgetConfig(editing.site_id, {
        display_name: input.display_name,
        initials: input.initials,
        subtitle: input.subtitle,
        brand_color: input.brand_color,
        visible_on_wall: input.visible_on_wall,
        visible_in_autonomous: input.visible_in_autonomous,
      });
      if (e) return { error: e };
    } else {
      const nextOrder = widgets.reduce((m, w) => Math.max(m, w.display_order), -1) + 1;
      const { error: e } = await createWallWidgetConfig({ ...input, display_order: nextOrder });
      if (e) return { error: e };
    }
    await load();
    return { error: null };
  };

  const toggle = async (w: WallWidgetConfigRow, field: 'wall' | 'auto') => {
    setMutating(true);
    setActionError(null);
    const patch =
      field === 'wall'
        ? { visible_on_wall: !w.visible_on_wall }
        : { visible_in_autonomous: !w.visible_in_autonomous };
    const { error: e } = await updateWallWidgetConfig(w.site_id, patch);
    if (e) setActionError(e);
    else await load();
    setMutating(false);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= widgets.length) return;
    setMutating(true);
    setActionError(null);
    const a = widgets[index];
    const b = widgets[target];
    const [ra, rb] = await Promise.all([
      updateWallWidgetConfig(a.site_id, { display_order: b.display_order }),
      updateWallWidgetConfig(b.site_id, { display_order: a.display_order }),
    ]);
    if (ra.error || rb.error) setActionError(ra.error ?? rb.error);
    else await load();
    setMutating(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Wall Widgets</h1>
            <span className="text-[10px] font-label px-2 py-0.5 rounded-full bg-secondary-500/15 text-secondary-300 whitespace-nowrap uppercase">
              Owner / Admin
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Control which site widgets appear on the Operations Wall and in Autonomous Operations — name, initials, brand colour, visibility and order.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            title="Refresh widgets"
          >
            <i className={`ri-refresh-line text-sm w-4 h-4 flex items-center justify-center ${loading ? 'animate-spin' : ''}`}></i>
            Refresh
          </button>
          {isAuthorised && availableSites.length > 0 && (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Add Widget
            </button>
          )}
        </div>
      </div>

      {/* Access guard */}
      {!isAuthorised && !loading && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
          <i className="ri-shield-keyhole-line text-3xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Owner / admin access required</h2>
          <p className="text-sm text-foreground-500 mt-2 max-w-lg mx-auto">
            Wall widget configuration is restricted to owners and admins.
          </p>
        </div>
      )}

      {/* Loading state */}
      {isAuthorised && loading && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-full h-12 bg-background-200/60 rounded-md"></div>
            </div>
          ))}
          <p className="text-xs font-label text-foreground-600 pt-2">Loading widget configuration…</p>
        </div>
      )}

      {/* Error state */}
      {isAuthorised && !loading && error && (
        <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center">
          <i className="ri-cloud-off-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Widget configuration unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2 max-w-lg mx-auto">{error}</p>
          <button
            onClick={() => void load()}
            className="mt-6 inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-300/60 rounded-md px-4 py-2 hover:border-background-300/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Retry
          </button>
        </div>
      )}

      {/* Inline action error banner (non-fatal) */}
      {isAuthorised && !loading && !error && actionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-red-400">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <i className="ri-close-line text-base w-4 h-4 flex items-center justify-center"></i>
          </button>
        </div>
      )}

      {/* Widget list */}
      {isAuthorised && !loading && !error && widgets.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
          <i className="ri-layout-grid-line text-3xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <p className="text-sm text-foreground-400 mt-3">No wall widgets configured yet.</p>
          {availableSites.length > 0 && (
            <button
              onClick={openAdd}
              className="mt-4 inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Add your first widget
            </button>
          )}
        </div>
      )}

      {isAuthorised && !loading && !error && widgets.length > 0 && (
        <div className="space-y-2.5">
          {widgets.map((w, index) => {
            const site = siteById.get(w.site_id);
            return (
              <div key={w.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-8 text-center text-[11px] font-label text-foreground-600 shrink-0">{index + 1}</span>
                    <span className={`${BRAND_SWATCH[w.brand_color] ?? 'bg-secondary-400'} text-background-950 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-heading font-bold`}>
                      {w.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground-200 whitespace-nowrap">{w.display_name}</p>
                        {w.is_hub && (
                          <span className="text-[10px] font-label px-1.5 py-0.5 rounded-full bg-accent-500/15 text-accent-400 whitespace-nowrap">HUB</span>
                        )}
                      </div>
                      <p className="text-[11px] font-label text-foreground-600 truncate">
                        {w.subtitle || 'No subtitle'} · {site?.site_key ?? 'unknown'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <ToggleSwitch checked={w.visible_on_wall} label="Wall" disabled={mutating} onChange={() => void toggle(w, 'wall')} />
                    <ToggleSwitch checked={w.visible_in_autonomous} label="Autonomous" disabled={mutating} onChange={() => void toggle(w, 'auto')} />

                    <div className="flex items-center gap-1 ml-1">
                      <button
                        type="button"
                        onClick={() => void move(index, -1)}
                        disabled={mutating || index === 0}
                        title="Move up"
                        className="w-8 h-8 flex items-center justify-center text-foreground-500 hover:text-foreground-200 hover:bg-background-200/50 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <i className="ri-arrow-up-line text-base w-4 h-4 flex items-center justify-center"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => void move(index, 1)}
                        disabled={mutating || index === widgets.length - 1}
                        title="Move down"
                        className="w-8 h-8 flex items-center justify-center text-foreground-500 hover:text-foreground-200 hover:bg-background-200/50 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <i className="ri-arrow-down-line text-base w-4 h-4 flex items-center justify-center"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(w)}
                        disabled={mutating}
                        title="Edit widget"
                        className="w-8 h-8 flex items-center justify-center text-accent-400 hover:bg-accent-500/10 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <i className="ri-pencil-line text-base w-4 h-4 flex items-center justify-center"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WidgetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        widget={editing}
        availableSites={availableSites}
        onSave={handleSave}
      />
    </div>
  );
}