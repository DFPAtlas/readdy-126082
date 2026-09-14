// ============================================================================
// DFP COMMAND 10 — PROJECT-SCOPED MONITORING DATA
// ============================================================================
// Loads the selected project's monitoring telemetry from the existing System
// Status tables (already project-scoped by internal_projects.id). Each source
// loads independently so a LibreNMS / runtime / uptime failure can never erase
// another panel's data. A failed query is surfaced as "unavailable", never
// rewritten into a misleading zero.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  MonitoredWebsite,
  SupabaseMonitor,
  EdgeFunctionMonitor,
  AgentMonitor,
  WebhookMonitor,
  MonitoringIncident,
  MonitoringAlert,
} from './monitoringTypes';

export type MonitoringSourceKey =
  | 'websites'
  | 'supabase'
  | 'edgeFunctions'
  | 'agents'
  | 'webhooks'
  | 'incidents'
  | 'alerts';

export interface ProjectMonitoringData {
  websites: MonitoredWebsite[];
  supabaseMonitors: SupabaseMonitor[];
  edgeFunctions: EdgeFunctionMonitor[];
  agents: AgentMonitor[];
  webhooks: WebhookMonitor[];
  incidents: MonitoringIncident[];
  alerts: MonitoringAlert[];
  loading: boolean;
  /** Per-source error message (empty record = all sources loaded). */
  errors: Partial<Record<MonitoringSourceKey, string>>;
  /** Whether the backend is connected at all. */
  configured: boolean;
  refresh: () => void;
}

export function useProjectMonitoring(projectId: number | undefined): ProjectMonitoringData {
  const [websites, setWebsites] = useState<MonitoredWebsite[]>([]);
  const [supabaseMonitors, setSupabaseMonitors] = useState<SupabaseMonitor[]>([]);
  const [edgeFunctions, setEdgeFunctions] = useState<EdgeFunctionMonitor[]>([]);
  const [agents, setAgents] = useState<AgentMonitor[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookMonitor[]>([]);
  const [incidents, setIncidents] = useState<MonitoringIncident[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<MonitoringSourceKey, string>>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const reset = useCallback(() => {
    setWebsites([]);
    setSupabaseMonitors([]);
    setEdgeFunctions([]);
    setAgents([]);
    setWebhooks([]);
    setIncidents([]);
    setAlerts([]);
    setErrors({});
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (!projectId) {
      reset();
      return;
    }
    if (!configured) {
      setErrors({
        websites: 'Monitoring data unavailable — backend is not connected.',
        supabase: 'Monitoring data unavailable — backend is not connected.',
        edgeFunctions: 'Monitoring data unavailable — backend is not connected.',
        agents: 'Monitoring data unavailable — backend is not connected.',
        webhooks: 'Monitoring data unavailable — backend is not connected.',
        incidents: 'Monitoring data unavailable — backend is not connected.',
        alerts: 'Monitoring data unavailable — backend is not connected.',
      });
      setLoading(false);
      return;
    }

    const id = ++requestIdRef.current;
    setLoading(true);
    setErrors({});

    const sources: { key: MonitoringSourceKey; run: () => Promise<{ data: unknown; error: string | null }> }[] = [
      {
        key: 'websites',
        run: async () => {
          const { data, error } = await supabase.from('internal_monitored_websites').select('*').eq('project_id', projectId).order('status');
          return { data: data ?? [], error: error?.message ?? null };
        },
      },
      {
        key: 'supabase',
        run: async () => {
          const { data, error } = await supabase.from('internal_supabase_monitors').select('*').eq('project_id', projectId).order('database_status');
          return { data: data ?? [], error: error?.message ?? null };
        },
      },
      {
        key: 'edgeFunctions',
        run: async () => {
          const { data, error } = await supabase.from('internal_edge_function_monitors').select('*').eq('project_id', projectId).order('status');
          return { data: data ?? [], error: error?.message ?? null };
        },
      },
      {
        key: 'agents',
        run: async () => {
          const { data, error } = await supabase.from('internal_agent_monitors').select('*').eq('project_id', projectId).order('status');
          return { data: data ?? [], error: error?.message ?? null };
        },
      },
      {
        key: 'webhooks',
        run: async () => {
          const { data, error } = await supabase.from('internal_webhook_monitors').select('*').eq('project_id', projectId).order('status');
          return { data: data ?? [], error: error?.message ?? null };
        },
      },
      {
        key: 'incidents',
        run: async () => {
          const { data, error } = await supabase.from('internal_monitoring_incidents').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
          return { data: data ?? [], error: error?.message ?? null };
        },
      },
      {
        key: 'alerts',
        run: async () => {
          const { data, error } = await supabase.from('internal_monitoring_alerts').select('*').eq('project_id', projectId).order('time_detected', { ascending: false });
          return { data: data ?? [], error: error?.message ?? null };
        },
      },
    ];

    const results = await Promise.allSettled(
      sources.map(async (s) => {
        const { data, error } = await s.run();
        return { key: s.key, data: data as unknown, error };
      }),
    );

    if (id !== requestIdRef.current) return;

    const nextErrors: Partial<Record<MonitoringSourceKey, string>> = {};
    const setByKey: Record<MonitoringSourceKey, (v: any) => void> = {
      websites: setWebsites,
      supabase: setSupabaseMonitors,
      edgeFunctions: setEdgeFunctions,
      agents: setAgents,
      webhooks: setWebhooks,
      incidents: setIncidents,
      alerts: setAlerts,
    };

    results.forEach((res, idx) => {
      const key = sources[idx].key;
      if (res.status === 'fulfilled') {
        const { data, error } = res.value as { key: MonitoringSourceKey; data: unknown; error: string | null };
        if (error) {
          nextErrors[key] = error;
          setByKey[key]([]);
        } else {
          setByKey[key](data);
        }
      } else {
        // A rejected promise is a source-level failure.
        nextErrors[key] = 'Monitoring source unavailable.';
        setByKey[key]([]);
      }
    });

    setErrors(nextErrors);
    setLoading(false);
  }, [projectId, configured, reset]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    websites,
    supabaseMonitors,
    edgeFunctions,
    agents,
    webhooks,
    incidents,
    alerts,
    loading,
    errors,
    configured,
    refresh,
  };
}