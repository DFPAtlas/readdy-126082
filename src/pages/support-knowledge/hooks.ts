import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { KnowledgeArticle, ResolutionRecord } from '@/types/support-tickets';

export interface KnowledgeFilters {
  site_id: string;
  category: string;
  status: string;
  visibility: string;
  search: string;
}

export interface ResolutionFilters {
  site_id: string;
  category: string;
  outcome: string;
}

export function useKnowledgeArticles(filters: KnowledgeFilters) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('support_list_knowledge_articles', {
      p_site_id: filters.site_id || null,
      p_category: filters.category || null,
      p_status: filters.status || null,
      p_visibility: filters.visibility || null,
      p_search: filters.search || null,
    });
    if (e) setError(e.message);
    else setArticles((data ?? []) as KnowledgeArticle[]);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { articles, loading, error, refresh };
}

export function useResolutions(filters: ResolutionFilters) {
  const [resolutions, setResolutions] = useState<ResolutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('support_list_resolution_records', {
      p_site_id: filters.site_id || null,
      p_category: filters.category || null,
      p_outcome: filters.outcome || null,
    });
    if (e) setError(e.message);
    else setResolutions((data ?? []) as ResolutionRecord[]);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { resolutions, loading, error, refresh };
}

export function friendlyRpcError(e: { message?: string }): string {
  const msg = e?.message ?? 'Operation failed.';
  const map: Record<string, string> = {
    FORBIDDEN: 'You do not have permission to do that.',
    TITLE_REQUIRED: 'A title is required.',
    CONTENT_REQUIRED: 'Article content is required.',
    ARTICLE_NOT_FOUND: 'Article not found.',
    RESOLUTION_NOT_FOUND: 'Resolution not found.',
    SYMPTOM_REQUIRED: 'A problem description is required.',
    INVALID_STATE: 'That action is not available in the current state.',
    INVALID_STATUS: 'Invalid status.',
    INVALID_OUTCOME: 'Invalid outcome.',
  };
  return map[msg] ?? msg;
}