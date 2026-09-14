import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { InfraFormFields, ProjectIntegration } from './infrastructureTypes';
import { activityMessages } from './infrastructureUtils';

export interface ProjectInfrastructureData {
  integration: ProjectIntegration | null;
  loading: boolean;
  error: string;
  saving: boolean;
  refresh: () => void;
  save: (fields: InfraFormFields) => Promise<string | null>;
}

function normalize(fields: InfraFormFields): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  (Object.keys(fields) as (keyof InfraFormFields)[]).forEach((key) => {
    const value = fields[key];
    out[key] = value && value.trim() !== '' ? value.trim() : null;
  });
  return out;
}

export function useProjectInfrastructure(
  projectId: number | null | undefined,
  projectName: string | null | undefined,
): ProjectInfrastructureData {
  const [integration, setIntegration] = useState<ProjectIntegration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const integrationRef = useRef<ProjectIntegration | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setIntegration(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: dbErr } = await supabase
        .from('internal_project_integrations')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      if (dbErr) throw dbErr;
      const record = (data as ProjectIntegration) ?? null;
      integrationRef.current = record;
      setIntegration(record);
    } catch (err: any) {
      setError(err.message || 'Infrastructure data unavailable.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (fields: InfraFormFields): Promise<string | null> => {
      if (!projectId) return 'Project is not available.';
      setSaving(true);
      try {
        const existing = integrationRef.current;
        const payload = { ...normalize(fields), updated_at: new Date().toISOString() };

        if (existing) {
          const { error: dbErr } = await supabase
            .from('internal_project_integrations')
            .update(payload)
            .eq('id', existing.id);
          if (dbErr) throw dbErr;
        } else {
          const { error: dbErr } = await supabase
            .from('internal_project_integrations')
            .insert({ project_id: projectId, ...payload });
          if (dbErr) throw dbErr;
        }

        // Activity log (non-critical — never block the save on it).
        try {
          const msgs = activityMessages(existing, fields);
          for (const msg of msgs) {
            await supabase.from('internal_activity_log').insert({
              entity_type: 'project',
              entity_id: projectId,
              action: msg,
              description: `${msg}: ${projectName ?? 'project'}`,
            });
          }
        } catch {
          // non-critical
        }

        await load();
        return null;
      } catch (err: any) {
        return err.message || 'Failed to save infrastructure mapping.';
      } finally {
        setSaving(false);
      }
    },
    [projectId, projectName, load],
  );

  return { integration, loading, error, saving, refresh: load, save };
}