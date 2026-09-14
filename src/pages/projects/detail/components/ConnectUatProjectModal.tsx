import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import { PROJECT_STATUS_COLORS } from '@/pages/admin/website-uat/types';

interface UatProjectOption {
  id: string;
  name: string;
  status: string;
  internal_project_id: number | null;
  objective: string | null;
}

interface ConnectUatProjectModalProps {
  open: boolean;
  projectId: number;
  projectName: string;
  onClose: () => void;
  /** Performs the actual link (owned by the hook, which also logs activity). */
  onConnect: (uatProjectId: string) => Promise<string | null>;
}

export default function ConnectUatProjectModal({
  open,
  projectId,
  projectName,
  onClose,
  onConnect,
}: ConnectUatProjectModalProps) {
  const [projects, setProjects] = useState<UatProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<UatProjectOption | null>(null);
  const [confirmError, setConfirmError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('uat_projects')
        .select('id,name,status,internal_project_id,objective')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setProjects((data ?? []) as UatProjectOption[]);
    } catch {
      setError('Failed to load UAT projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setConfirmTarget(null);
      setConfirmError('');
      load();
    }
  }, [open, load]);

  const doConnect = useCallback(
    async (target: UatProjectOption) => {
      setBusyId(target.id);
      setConfirmError('');
      try {
        const result = await onConnect(target.id);
        if (result) {
          setConfirmError(result);
        } else {
          setConfirmTarget(null);
          onClose();
        }
      } finally {
        setBusyId(null);
      }
    },
    [onConnect, onClose],
  );

  const handleSelect = (p: UatProjectOption) => {
    if (p.internal_project_id === projectId) return;
    if (p.internal_project_id != null) {
      setConfirmTarget(p);
      setConfirmError('');
      return;
    }
    void doConnect(p);
  };

  return (
    <Modal open={open} onClose={onClose} title="Connect UAT Project" className="max-w-xl" lockScroll={true} footer={null}>
      <div className="p-5">
        <p className="text-sm text-foreground-400">
          Link an existing UAT project to <span className="text-foreground-100">{projectName}</span>. The link uses the
          project ID, never the name.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-foreground-500 py-8">Loading UAT projects...</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-foreground-500 py-8">No UAT projects exist yet.</p>
        ) : (
          <div className="grid gap-2 mt-4 max-h-[50vh] overflow-y-auto pr-1">
            {projects.map((p) => {
              const isLinkedHere = p.internal_project_id === projectId;
              const isLinkedElsewhere = p.internal_project_id != null && p.internal_project_id !== projectId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  disabled={busyId !== null}
                  className="w-full text-left bg-background-50 border border-background-200/60 rounded-lg p-3 hover:border-accent-500/30 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground-100">{p.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PROJECT_STATUS_COLORS[p.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                      {p.status}
                    </span>
                    {isLinkedHere ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400">Linked</span>
                    ) : isLinkedElsewhere ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400">Linked to another project</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-foreground-500/10 text-foreground-500">Available</span>
                    )}
                    {busyId === p.id && <i className="ri-loader-4-line animate-spin text-accent-400 w-3.5 h-3.5 flex items-center justify-center"></i>}
                  </div>
                  {p.objective && <p className="text-xs text-foreground-500 mt-1 line-clamp-1">{p.objective}</p>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title="Reassign UAT Project"
        variant="dialog"
        lockScroll={true}
      >
        <div className="p-5">
          <p className="text-sm text-foreground-300 leading-relaxed">
            <span className="text-foreground-100">{confirmTarget?.name}</span> is already linked to another Digital
            Footprint project. Reassigning it to <span className="text-foreground-100">{projectName}</span> will detach
            it from its current project.
          </p>
          {confirmError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
              <p className="text-xs text-red-400">{confirmError}</p>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={() => setConfirmTarget(null)}
              className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmTarget && doConnect(confirmTarget)}
              disabled={busyId !== null}
              className="bg-amber-500 hover:bg-amber-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {busyId === confirmTarget?.id ? 'Reassigning...' : 'Reassign'}
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}