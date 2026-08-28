import { useEffect, useMemo, useState } from 'react';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useRuntimeHealth, checkRuntimeHealth, sweepRuntimeHealth, refreshHistory, refreshConfig } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { buildRuntimeHealthRows, type HealthTarget } from '@/lib/ai-operations/runtimeHealth';
import HealthKpis from '@/pages/ai-operations/runtime-health/components/HealthKpis';
import ConnectionTable from '@/pages/ai-operations/runtime-health/components/ConnectionTable';
import EffectiveRuntimePanel from '@/pages/ai-operations/runtime-health/components/EffectiveRuntimePanel';
import HealthHistory from '@/pages/ai-operations/runtime-health/components/HealthHistory';
import MonitoringRules from '@/pages/ai-operations/runtime-health/components/MonitoringRules';
import ConfigurationReadiness from '@/pages/ai-operations/runtime-health/components/ConfigurationReadiness';
import ScheduledHandshake from '@/pages/ai-operations/runtime-health/components/ScheduledHandshake';

type Tab = 'connections' | 'config' | 'history' | 'rules';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'connections', label: 'Connections', icon: 'ri-radar-line' },
  { key: 'config', label: 'Configuration Readiness', icon: 'ri-key-2-line' },
  { key: 'history', label: 'Health History', icon: 'ri-history-line' },
  { key: 'rules', label: 'Monitoring Rules', icon: 'ri-settings-4-line' },
];

export default function RuntimeHealthPage() {
  const data = useGroupLiveData();
  const health = useRuntimeHealth();
  const [tab, setTab] = useState<Tab>('connections');

  // Load persisted health history + rules + config readiness once on mount.
  useEffect(() => {
    void refreshHistory();
    void refreshConfig();
  }, []);

  const rows = useMemo(
    () => buildRuntimeHealthRows(data.tools, data.providers, health.results),
    [data.tools, data.providers, health.results],
  );

  const targets: HealthTarget[] = useMemo(
    () =>
      rows
        .filter((r) => r.system !== null)
        .map((r) => ({ system: r.system as string, connectionKey: r.key })),
    [rows],
  );

  const handleSweep = () => {
    if (health.sweeping) return;
    void sweepRuntimeHealth(targets);
  };

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-foreground-400">Loading runtime health registry…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Runtime Connectivity &amp; Health</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              <i className="ri-radar-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Health verification
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-3xl">
            Verify which production services are actually reachable, review persisted health history, and manage recurring monitoring. Checks are read-only and run server-side — no agent, workflow, model, tool, email or financial action is ever performed.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <button
            onClick={handleSweep}
            disabled={health.sweeping || targets.length === 0}
            className="inline-flex items-center gap-2 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`ri-radar-line text-sm w-4 h-4 flex items-center justify-center ${health.sweeping ? 'animate-spin' : ''}`}></i>
            {health.sweeping ? 'Running Sweep…' : 'Run Health Sweep'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 bg-background-100 border border-background-200/60 rounded-full p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 text-xs font-label rounded-full px-4 py-2 transition-colors cursor-pointer whitespace-nowrap ${tab === t.key ? 'bg-accent-500 text-background-950 font-semibold' : 'text-foreground-500 hover:text-foreground-100'}`}
          >
            <i className={`${t.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'connections' && (
        <>
          {/* Source-state explainer */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2.5 py-0.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Manual checks + scheduled monitoring
            </span>
            <p className="text-xs text-foreground-500">
              <strong className="text-foreground-300">Registry Health</strong> reflects persisted configuration metadata;{' '}
              <strong className="text-foreground-300">Runtime Connectivity</strong> is a live server-side verification. Scheduled monitoring runs server-side every 15 minutes (rules below); results are persisted to health history.
            </p>
          </div>

          {/* Error banner */}
          {health.error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 flex items-start gap-3">
              <i className="ri-alert-line text-red-400 text-lg w-5 h-5 flex items-center justify-center shrink-0"></i>
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-300">Health check failed</p>
                <p className="text-xs text-red-400/80 mt-0.5">{health.error}</p>
              </div>
            </div>
          )}

          <HealthKpis sweep={health.lastSweep} checkedCount={targets.length} />

          <ConnectionTable
            rows={rows}
            checkingKeys={health.checkingKeys}
            onCheck={(system, key) => void checkRuntimeHealth(system, key)}
          />

          <EffectiveRuntimePanel />

          {/* Runtime execution note */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="w-8 h-8 flex items-center justify-center rounded-md bg-red-500/10">
              <i className="ri-shield-cross-line text-red-400 text-base w-5 h-5 flex items-center justify-center"></i>
            </span>
            <p className="text-xs text-foreground-500">
              <strong className="text-foreground-300">Runtime Execution is Disabled.</strong> Health checks are permitted while Production Enabled = 0. The master kill switch must be provisioned before any agent, workflow or model execution can begin.
            </p>
          </div>
        </>
      )}

      {tab === 'config' && (
        <>
          <ScheduledHandshake />
          <ConfigurationReadiness />
        </>
      )}

      {tab === 'history' && <HealthHistory />}
      {tab === 'rules' && <MonitoringRules />}
    </div>
  );
}