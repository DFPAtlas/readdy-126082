// ============================================================================
// Wallboard — display configuration (settings) layer.
//
// Single controlled source of truth for wallboard DISPLAY behaviour only:
// enabled/ordered views, rotation, refresh intervals, clock format, and a few
// safe display preferences. This is intentionally NOT a general DFP Command
// settings platform, and it never holds secrets (no keys/tokens/endpoints).
//
// Persistence model: localStorage, keyed to this browser/display device. The
// wallboard is an office wall display configured per physical screen; settings
// are not shared across devices, so a lightweight local store is the right
// model — no new database table, no auth coupling, and no security surface.
// ============================================================================

export type WallboardClockFormat = '12h' | '24h';

export interface WallboardViewDef {
  id: string;
  label: string;
  /** Mandatory views cannot be disabled. Incident Mode is mandatory by
   *  architecture (rendered as an override, not listed here). */
  essential: boolean;
}

// Stable view identifiers — the single source of truth for the rotation.
// Order here is the DEFAULT rotation order; never rely on display labels.
export const WALLBOARD_VIEWS: WallboardViewDef[] = [
  { id: 'command-overview', label: 'Command Overview', essential: false },
  { id: 'active-operations', label: 'Active Operations', essential: false },
  { id: 'sites', label: 'Sites', essential: false },
  { id: 'alerts-approvals', label: 'Alerts & Approvals', essential: false },
  { id: 'costs-health', label: 'Costs & Health', essential: false },
  { id: 'business', label: 'Business', essential: false },
  { id: 'infrastructure', label: 'Infrastructure', essential: false },
  { id: 'power', label: 'Power & Comm Room', essential: false },
  { id: 'security', label: 'Security & Connectivity', essential: false },
  { id: 'backups', label: 'Backups & Recovery', essential: false },
  { id: 'sites-services', label: 'Sites & Services', essential: false },
  { id: 'operations', label: 'Operations Workload', essential: false },
  { id: 'daily-briefing', label: 'Daily Briefing', essential: false },
  { id: 'trends', label: 'Trends', essential: false },
  { id: 'deployments', label: 'Deployments & Releases', essential: false },
  { id: 'ai-capacity', label: 'AI Capacity', essential: false },
  { id: 'portfolio', label: 'Project Portfolio', essential: false },
  { id: 'sales-pipeline', label: 'Sales Pipeline', essential: false },
  { id: 'support', label: 'Support & SLA', essential: false },
  { id: 'launch-readiness', label: 'Launch Readiness', essential: false },
  { id: 'github-repos', label: 'GitHub & Repos', essential: false },
  { id: 'databases', label: 'Databases & Supabase', essential: false },
  { id: 'n8n-workflows', label: 'Automation & Workflows', essential: false },
  { id: 'ai-infrastructure', label: 'AI Infrastructure', essential: false },
  { id: 'master-agents', label: 'Master Agents', essential: false },
  { id: 'orchestration', label: 'Orchestration & Workflow Map', essential: false },
  { id: 'knowledge-memory', label: 'Knowledge & Memory', essential: false },
  { id: 'communications', label: 'Communications', essential: false },
  { id: 'scheduled-operations', label: 'Scheduled Operations', essential: false },
];

export interface WallboardSettings {
  version: number;
  /** Ordered list of enabled view ids (subset of WALLBOARD_VIEWS). */
  enabledViews: string[];
  rotationEnabled: boolean;
  /** Seconds. Bounded 10–120. */
  rotationInterval: number;
  /** Seconds. 0 = auto-refresh off, otherwise bounded 15–300. */
  refreshInterval: number;
  /** Seconds. Bounded 300–3600 (5–60 min). */
  weatherInterval: number;
  clockFormat: WallboardClockFormat;
  /** Whether the wallboard should start in focus mode on load. */
  focusModeDefault: boolean;
  /** Stored user preference only — never force browser full-screen. */
  fullscreenPreference: boolean;
  /** Toggles the secondary runtime detail chips in the status bar. */
  showSecondaryMetrics: boolean;
}

export const WALLBOARD_SETTINGS_BOUNDS = {
  rotationInterval: { min: 10, max: 120 },
  refreshInterval: { min: 15, max: 300 },
  weatherInterval: { min: 300, max: 3600 },
} as const;

const SETTINGS_VERSION = 1;
const STORAGE_KEY = 'dfp-wallboard-settings';

export function getDefaultWallboardSettings(): WallboardSettings {
  return {
    version: SETTINGS_VERSION,
    enabledViews: WALLBOARD_VIEWS.map((v) => v.id),
    rotationEnabled: true,
    rotationInterval: 20,
    refreshInterval: 30,
    weatherInterval: 600,
    clockFormat: '24h',
    focusModeDefault: false,
    fullscreenPreference: false,
    showSecondaryMetrics: true,
  };
}

function clamp(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalise arbitrary (possibly corrupted) input into valid settings.
 * Every field is validated independently and falls back to a safe default —
 * the wallboard always loads, even from broken storage.
 */
export function sanitizeWallboardSettings(raw: unknown): WallboardSettings {
  const def = getDefaultWallboardSettings();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, unknown>;

  const knownIds = new Set(WALLBOARD_VIEWS.map((v) => v.id));

  let enabledViews = def.enabledViews;
  if (Array.isArray(r.enabledViews)) {
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const id of r.enabledViews) {
      if (typeof id === 'string' && knownIds.has(id) && !seen.has(id)) {
        seen.add(id);
        cleaned.push(id);
      }
    }
    if (cleaned.length > 0) enabledViews = cleaned;
  }

  // Re-inject any mandatory (essential) view that may have been dropped.
  for (const v of WALLBOARD_VIEWS) {
    if (v.essential && !enabledViews.includes(v.id)) {
      const idx = def.enabledViews.indexOf(v.id);
      if (idx >= 0) enabledViews.splice(Math.min(idx, enabledViews.length), 0, v.id);
      else enabledViews.push(v.id);
    }
  }

  const rotationInterval = clamp(
    r.rotationInterval,
    WALLBOARD_SETTINGS_BOUNDS.rotationInterval.min,
    WALLBOARD_SETTINGS_BOUNDS.rotationInterval.max,
  );
  // 0 is a valid "off" value for refresh (preserves existing behaviour).
  const refreshInterval =
    r.refreshInterval === 0
      ? 0
      : clamp(r.refreshInterval, WALLBOARD_SETTINGS_BOUNDS.refreshInterval.min, WALLBOARD_SETTINGS_BOUNDS.refreshInterval.max);
  const weatherInterval = clamp(
    r.weatherInterval,
    WALLBOARD_SETTINGS_BOUNDS.weatherInterval.min,
    WALLBOARD_SETTINGS_BOUNDS.weatherInterval.max,
  );

  return {
    version: SETTINGS_VERSION,
    enabledViews,
    rotationEnabled: r.rotationEnabled !== false,
    rotationInterval,
    refreshInterval,
    weatherInterval,
    clockFormat: r.clockFormat === '12h' ? '12h' : '24h',
    focusModeDefault: r.focusModeDefault === true,
    fullscreenPreference: r.fullscreenPreference === true,
    showSecondaryMetrics: r.showSecondaryMetrics !== false,
  };
}

export function loadWallboardSettings(): WallboardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWallboardSettings();
    return sanitizeWallboardSettings(JSON.parse(raw));
  } catch {
    return getDefaultWallboardSettings();
  }
}

export function saveWallboardSettings(settings: WallboardSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Reset display settings only — never touches data, accounts, or monitoring. */
export function resetWallboardSettings(): WallboardSettings {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — still return defaults
  }
  return getDefaultWallboardSettings();
}