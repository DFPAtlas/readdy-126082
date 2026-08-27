import { useEffect, useState, useCallback } from 'react';
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

const ROTATION_VIEWS = 5;
const ROTATION_LABELS = ['Group Overview', 'Active Operations', 'Sites', 'Alerts & Approvals', 'Costs & Health'];

export default function WallboardPage() {
  const [now, setNow] = useState<Date>(() => new Date());
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
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

  // Auto-refresh — local demo refresh only (no production polling).
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => setLastRefreshed(new Date()), autoRefresh * 1000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  // Auto rotation — local state timer only.
  useEffect(() => {
    if (!rotation) return;
    const id = setInterval(() => setRotationIndex((i) => (i + 1) % ROTATION_VIEWS), rotation * 1000);
    return () => clearInterval(id);
  }, [rotation]);

  // Reset rotation index when rotation is disabled.
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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background-50 text-foreground-50">
      <WallboardHeader
        now={now}
        lastRefreshed={lastRefreshed}
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
        <p className="text-[11px] font-label text-foreground-600">
          Last refresh {lastRefreshed.toLocaleTimeString('en-US', { hour12: false })}
          {autoRefresh > 0 ? ` · auto-refresh ${autoRefresh}s` : ''}
          {rotation > 0 ? ` · rotating every ${rotation}s` : ''}
        </p>
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
        <div className="col-span-3 min-h-0"><SystemHealth /></div>

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