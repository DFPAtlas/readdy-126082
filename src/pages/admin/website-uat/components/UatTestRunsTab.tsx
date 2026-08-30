import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UatJob } from '../types';
import TesterMarketplaceModal from './TesterMarketplaceModal';
import TesterMarketplacePanel from './TesterMarketplacePanel';
import TesterAssignmentsPanel from './TesterAssignmentsPanel';
import UatJobFormModal from './UatJobFormModal';
import UatTestCasesSection from './UatTestCasesSection';

export default function UatTestRunsTab() {
  const [jobs, setJobs] = useState<UatJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});
  const [configureJob, setConfigureJob] = useState<UatJob | null>(null);
  const [testCaseCounts, setTestCaseCounts] = useState<Record<string, number>>({});
  const [showCreate, setShowCreate] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const { data, error: err } = await supabase.from('uat_jobs').select('*').order('created_at', { ascending: false });
      if (err) throw err;

      const projectIds = [...new Set((data || []).map((j: Record<string, unknown>) => j.project_id))];
      const envIds = [...new Set((data || []).map((j: Record<string, unknown>) => j.environment_id).filter(Boolean))];
      const [{ data: projects }, { data: envs }, { data: assignments }, { data: testCases }] = await Promise.all([
        projectIds.length > 0 ? supabase.from('uat_projects').select('id,name').in('id', projectIds) : Promise.resolve({ data: [] }),
        envIds.length > 0 ? supabase.from('uat_environments').select('id,environment_name').in('id', envIds as string[]) : Promise.resolve({ data: [] }),
        supabase.from('uat_assignments').select('job_id'),
        supabase.from('uat_test_cases').select('job_id').is('archived_at', null),
      ]);

      const projMap = Object.fromEntries((projects || []).map((p: Record<string, unknown>) => [p.id, p.name]));
      const envMap = Object.fromEntries((envs || []).map((e: Record<string, unknown>) => [e.id, e.environment_name]));
      const counts: Record<string, number> = {};
      (assignments || []).forEach((a: Record<string, unknown>) => {
        counts[a.job_id as string] = (counts[a.job_id as string] || 0) + 1;
      });
      setAssignmentCounts(counts);

      const tcCounts: Record<string, number> = {};
      (testCases || []).forEach((tc: Record<string, unknown>) => {
        if (tc.job_id) tcCounts[tc.job_id as string] = (tcCounts[tc.job_id as string] || 0) + 1;
      });
      setTestCaseCounts(tcCounts);

      setJobs((data || []).map((j: Record<string, unknown>) => ({
        ...j,
        project_name: projMap[j.project_id as string] || 'Unknown',
        environment_name: envMap[j.environment_id as string] || '',
      })) as UatJob[]);
    } catch {
      setError('Failed to load test jobs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const STATUS_STYLES: Record<string, string> = {
    open: 'bg-sky-500/10 text-sky-400',
    in_progress: 'bg-yellow-500/10 text-yellow-400',
    completed: 'bg-emerald-500/10 text-emerald-400',
    cancelled: 'bg-foreground-500/10 text-foreground-500',
  };

  const configMinSlots = configureJob
    ? Math.max(configureJob.reserve_count ?? 0, configureJob.tester_slots_filled ?? 0, assignmentCounts[configureJob.id] ?? 0)
    : 0;

  const handleCreated = (jobId: string) => {
    setShowCreate(false);
    loadData();
    if (jobId) setExpandedId(jobId);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground-100">Test Runs</h3>
          <p className="text-xs text-foreground-500 mt-0.5">Create UAT test jobs and manage the tester marketplace.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
          New Test Run
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-foreground-400 py-8">Loading test jobs...</div>
      ) : error ? (
        <div className="text-sm text-red-400 py-8">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <i className="ri-test-tube-line text-3xl text-foreground-500 w-8 h-8 flex items-center justify-center mx-auto mb-3"></i>
          <p className="text-sm text-foreground-500">No test jobs created yet.</p>
          <p className="text-xs text-foreground-600 mt-1">Click "New Test Run" to create your first UAT job.</p>
        </div>
      ) : (
      <div className="grid gap-3">
        {jobs.map((j) => (
        <div key={j.id} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
          <div onClick={() => setExpandedId(expandedId === j.id ? null : j.id)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-background-50/50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground-50">{j.title}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[j.status] || 'bg-foreground-500/10 text-foreground-500'}`}>{j.status.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-foreground-500 mt-0.5">{j.project_name}{j.environment_name ? ` · ${j.environment_name}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-foreground-500">{assignmentCounts[j.id] || 0}/{j.max_testers} testers</span>
              <span className="text-xs text-foreground-500 font-medium">£{j.pay_amount}/{j.pay_type === 'per_hour' ? 'hr' : 'fixed'}</span>
              <i className={`${expandedId === j.id ? 'ri-arrow-up-s-fill' : 'ri-arrow-down-s-fill'} text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
            </div>
          </div>
          {expandedId === j.id && (
            <div className="border-t border-background-200/60 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div><span className="text-foreground-500">Experience:</span> <span className="text-foreground-200 ml-1">{j.required_experience_level}</span></div>
                <div><span className="text-foreground-500">Pay:</span> <span className="text-foreground-200 ml-1">£{j.pay_amount} {j.pay_type.replace('_', ' ')}</span></div>
                <div><span className="text-foreground-500">Max testers:</span> <span className="text-foreground-200 ml-1">{j.max_testers}</span></div>
                <div className="col-span-2"><span className="text-foreground-500">Devices:</span> <span className="text-foreground-200 ml-1">{j.required_devices?.join(', ') || 'Any'}</span></div>
                <div><span className="text-foreground-500">Browsers:</span> <span className="text-foreground-200 ml-1">{j.required_browsers?.join(', ') || 'Any'}</span></div>
              </div>
              <div className="mt-4">
                <UatTestCasesSection
                  job={j}
                  projectName={j.project_name || 'Unknown'}
                  caseCount={testCaseCounts[j.id] ?? 0}
                  onChanged={loadData}
                />
              </div>
              <div className="mt-4">
                <TesterMarketplacePanel
                  job={j}
                  testCaseCount={testCaseCounts[j.id] ?? 0}
                  onChanged={loadData}
                  onConfigure={() => setConfigureJob(j)}
                />
              </div>
              <div className="mt-4">
                <TesterAssignmentsPanel job={j} onChanged={loadData} />
              </div>
              {j.description && <p className="text-xs text-foreground-500 mt-3">{j.description}</p>}
            </div>
          )}
        </div>
      ))}
        </div>
      )}

      <UatJobFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />

      <TesterMarketplaceModal
        open={configureJob !== null}
        job={configureJob}
        minSlots={configMinSlots}
        hasTesterActivity={configMinSlots > 0}
        onClose={() => setConfigureJob(null)}
        onSaved={loadData}
      />
    </>
  );
}