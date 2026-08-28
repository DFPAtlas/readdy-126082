import { useEffect, useState, useCallback, useMemo } from 'react';
import { GroupLiveDataProvider, useGroupLiveData, refreshGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useRuntimeHealth, refreshHistory } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { effectivePathSummary, resolveEffectiveHealth } from '@/lib/ai-operations/runtimeHealthSource';
import WallboardHeader from '@/pages/ai-operations/wallboard/components/WallboardHeader';
import KpiStrip from '@/pages/ai-operations/wallboard/components/KpiStrip';
import GroupSiteStatus from '@/pages/ai-operations/wallboard/components/GroupSiteStatus';
import ActiveOperations from '@/pages/ai-operations/wallboard/components/ActiveOperations';
import AgentsWorking from '@/pages/ai-operations/wallboard/components/AgentsWorking';
import CriticalAlerts from '@/pages/ai-operations/wallboard/components/CriticalAlerts';
import ApprovalsWatch from '@/pages/ai-operations/wallboard/components/ApprovalsWatch';
import SystemHealth from '@/pages/ai-operations/wallboard/components/SystemHealth';
import LiveActivity from '@/pages/ai-operations/wallboard/components/LiveActivity';
import UsersOnline from '@/pages/ai-operations/wallboard/components/UsersOnline';
import AiSpend from '@/pages/ai-operations/wallboard/components/AiSpend';
import PrivateRuntimeBridge from '@/pages/ai-operations/wallboard/components/PrivateRuntimeBridge';

const ROTATION_VIEWS = 5;
const ROTATION_LABELS = ['Group Overview', 'Active Operations', 'Sites', 'Alerts & Approvals', 'Costs & Health'];

export default function WallboardPage() {
  return (
    <GroupLiveDataProvider>
      <WallboardInner />
    </GroupLiveDataProvider>
  );
}

function WallboardInner() {
  const data = useGroupLiveData();
  const healthState = useRuntimeHealth();
  const [now, setNow] = useState<Date>(() => new Date());
  const [autoRefresh, setAutoRefresh] = useState(30);
  const [focusMode, setFocusMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [rotationIndex, setRotationIndex] = useState(0);

  // Clock — updates once per second for the header time display.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load persisted runtime health once on mount.
  useEffect(() => {
    void refreshHistory();
  }, []);

  // Auto-refresh — one coordinated live-registry refresh (no per-widget polling).
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void refreshGroupLiveData();
      void refreshHistory();
    }, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  // Auto rotation — local state timer only.
  useEffect(() => {
    if (!rotation) return;
    const id = setInterval(() => setRotationIndex((i) => (i + 1) % ROTATION_VIEWS), rotation * 1000);
    return () => clearInterval(id);
  }, [rotation]);

  const handleRotationChange = useCallback((seconds: number) => {
    setRotation(seconds);
    if (seconds === 0) setRotationIndex(0);
  }, []);

  // Fullscreen — track actual browser state; degrade gracefully.
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const sourceLabel = data.mode === 'unavailable' ? 'Unavailable' : 'Partial Live Data';

  const runtimeSummary = useMemo(() => {
    const latest = healthState.latestBySystem;
    if (latest.size === 0) return null;
    let healthy = 0;
    let degraded = 0;
    let unavailable = 0;
    for (const system of latest.keys()) {
      const v = resolveEffectiveHealth(latest, system, healthState.effectivePaths);
      if (!v) continue;
      if (v.currentStatus === 'healthy') healthy += 1;
      else if (v.currentStatus === 'degraded') degraded += 1;
      else if (v.currentStatus === 'unavailable') unavailable += 1;
    }
    return `${healthy} healthy · ${degraded} degraded · ${unavailable} unavailable`;
  }, [healthState.latestBySystem, healthState.effectivePaths]);

  const localPathLabel = useMemo(() => {
    const lines: string[] = [];
    for (const system of ['n8n', 'ollama']) {
      const path = healthState.effectivePaths[system];
      if (!path) continue;
      const sources = healthState.latestBySystem.get(system);
      lines.push(effectivePathSummary(system, path, sources?.local_bridge, sources?.cloud_edge));
    }
    return lines.length ? lines.join('  ·  ') : null;
  }, [healthState.latestBySystem, healthState.effectivePaths]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background-50 text-foreground-50">
      <WallboardHeader
        now={now}
        lastRefreshed={data.lastRefreshed}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        focusMode={focusMode}
        onFocusToggle={() => setFocusMode((f) => !f)}
        fullscreen={fullscreen}
        onFullscreenToggle={handleFullscreenToggle}
        rotation={rotation}
        onRotationChange={handleRotationChange}
      />

      <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-label text-foreground-600">
            Last refresh {data.lastRefreshed.toLocaleTimeString('en-US', { hour12: false })}
            {autoRefresh > 0 ? ` · auto-refresh ${autoRefresh}s` : ''}
            {rotation > 0 ? ` · rotating every ${rotation}s` : ''}
          </p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2.5 py-0.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {sourceLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/25 rounded-full px-2.5 py-0.5 whitespace-nowrap">
            <i className="ri-radar-line w-3.5 h-3.5 flex items-center justify-center"></i>
            {runtimeSummary
              ? `Runtime: ${runtimeSummary}`
              : 'Runtime Connectivity: Not Checked'}
          </span>
          {localPathLabel && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2.5 py-0.5 whitespace-nowrap">
              <i className="ri-server-line w-3.5 h-3.5 flex items-center justify-center"></i>
              {localPathLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-0.5 whitespace-nowrap">
            <i className="ri-shield-cross-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Runtime Execution: BLOCKED
          </span>
        </div>
        {rotation > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/25 rounded-full px-2.5 py-0.5 whitespace-nowrap">
            <i className="ri-loop-left-line w-3.5 h-3.5 flex items-center justify-center"></i>
            View {rotationIndex + 1} of {ROTATION_VIEWS} · {ROTATION_LABELS[rotationIndex]}
          </span>
        )}
      </div>

      {focusMode ? (
        <FocusLayout />
      ) : rotation > 0 ? (
        <RotationLayout index={rotationIndex} />
      ) : (
        <StandardLayout />
      )}
    </div>
  );
}

function StandardLayout() {
  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <KpiStrip />
      <div className="grid grid-cols-12 grid-rows-3 gap-3 mt-3 flex-1 min-h-0">
        <div className="col-span-7 min-h-0"><GroupSiteStatus /></div>
        <div className="col-span-5 min-h-0"><ActiveOperations /></div>

        <div className="col-span-5 min-h-0"><CriticalAlerts /></div>
        <div className="col-span-4 min-h-0"><ApprovalsWatch /></div>
        <div className="col-span-3 min-h-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0"><SystemHealth /></div>
          <div className="flex-1 min-h-0"><PrivateRuntimeBridge /></div>
        </div>

        <div className="col-span-4 min-h-0"><AgentsWorking /></div>
        <div className="col-span-5 min-h-0"><LiveActivity /></div>
        <div className="col-span-3 min-h-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0"><UsersOnline /></div>
          <div className="flex-1 min-h-0"><AiSpend /></div>
        </div>
      </div>
    </main>
  );
}

function FocusLayout() {
  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <KpiStrip large />
      <div className="grid grid-cols-12 grid-rows-2 gap-3 mt-3 flex-1 min-h-0">
        <div className="col-span-7 min-h-0"><GroupSiteStatus /></div>
        <div className="col-span-5 min-h-0"><CriticalAlerts /></div>
        <div className="col-span-12 min-h-0"><ActiveOperations /></div>
      </div>
    </main>
  );
}

function RotationLayout({ index }: { index: number }) {
  if (index === 0) {
    return (
      <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
        <KpiStrip />
        <div className="grid grid-cols-12 gap-3 mt-3 flex-1 min-h-0">
          <div className="col-span-7 min-h-0"><GroupSiteStatus /></div>
          <div className="col-span-5 min-h-0 flex flex-col gap-3">
            <div className="flex-1 min-h-0"><ActiveOperations /></div>
            <div className="flex-1 min-h-0"><AiSpend /></div>
          </div>
        </div>
      </main>
    );
  }
  if (index === 1) {
    return (
      <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
        <KpiStrip />
        <div className="grid grid-cols-12 gap-3 mt-3 flex-1 min-h-0">
          <div className="col-span-7 min-h-0"><ActiveOperations /></div>
          <div className="col-span-5 min-h-0"><AgentsWorking /></div>
        </div>
      </main>
    );
  }
  if (index === 2) {
    return (
      <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
        <KpiStrip />
        <div className="mt-3 flex-1 min-h-0">
          <GroupSiteStatus />
        </div>
      </main>
    );
  }
  if (index === 3) {
    return (
      <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
        <KpiStrip />
        <div className="grid grid-cols-12 gap-3 mt-3 flex-1 min-h-0">
          <div className="col-span-6 min-h-0"><CriticalAlerts /></div>
          <div className="col-span-6 min-h-0"><ApprovalsWatch /></div>
        </div>
      </main>
    );
  }
  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <KpiStrip />
      <div className="grid grid-cols-12 gap-3 mt-3 flex-1 min-h-0">
        <div className="col-span-4 min-h-0"><AiSpend /></div>
        <div className="col-span-5 min-h-0"><SystemHealth /></div>
        <div className="col-span-3 min-h-0"><UsersOnline /></div>
      </div>
    </main>
  );
}