import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { DashboardSummary } from './types';
import WebsiteRegisterTab from './components/WebsiteRegisterTab';
import WebsiteChangesTab from './components/WebsiteChangesTab';
import PageReviewTab from './components/PageReviewTab';
import LinkCheckerTab from './components/LinkCheckerTab';
import ImageManagerTab from './components/ImageManagerTab';
import UatTestRunsTab from './components/UatTestRunsTab';
import ApprovalQueueTab from './components/ApprovalQueueTab';

const TABS = [
  { key: 'register', label: 'UAT Projects', icon: 'ri-global-line' },
  { key: 'changes', label: 'Bug Reports', icon: 'ri-bug-line' },
  { key: 'page-review', label: 'Test Results', icon: 'ri-file-check-line' },
  { key: 'link-checker', label: 'Evidence', icon: 'ri-camera-line' },
  { key: 'image-manager', label: 'Sessions', icon: 'ri-timer-line' },
  { key: 'uat-runs', label: 'Test Runs', icon: 'ri-test-tube-line' },
  { key: 'approval', label: 'Approvals', icon: 'ri-shield-check-line' },
];

function SkeletonCard() {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-20 bg-background-300/40 rounded"></div>
        <div className="w-8 h-8 bg-background-300/40 rounded-lg"></div>
      </div>
      <div className="h-7 w-12 bg-background-300/40 rounded"></div>
    </div>
  );
}

function SummaryCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
      </div>
      <p className="text-2xl font-heading font-bold text-foreground-100">{value}</p>
    </div>
  );
}

export default function WebsiteUatDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'register';
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      setError('');
      const [
        { count: projectsActive },
        { count: openBugs },
        { count: testersAvailable },
        { count: sessionsActive },
        { count: pendingApprovals },
        { count: testsPassed },
        { count: testsFailed },
        { count: readyForDeploy },
      ] = await Promise.all([
        supabase.from('uat_projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('uat_feedback').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('uat_testers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('uat_sessions').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('uat_approvals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('uat_test_case_results').select('*', { count: 'exact', head: true }).eq('status', 'passed'),
        supabase.from('uat_test_case_results').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('uat_reports').select('*', { count: 'exact', head: true }).gte('go_no_go_score', 85).eq('recommendation', 'go'),
      ]);

      setSummary({
        projectsActive: projectsActive ?? 0,
        openBugs: openBugs ?? 0,
        testersAvailable: testersAvailable ?? 0,
        sessionsActive: sessionsActive ?? 0,
        pendingApprovals: pendingApprovals ?? 0,
        testsPassed: testsPassed ?? 0,
        testsFailed: testsFailed ?? 0,
        readyForDeploy: readyForDeploy ?? 0,
      });
    } catch {
      setError('Failed to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">UAT Testing Dashboard</h1>
          <p className="text-sm text-foreground-500 mt-1">Manage DFP UAT projects, testers, sessions, bug reports, and deployment approvals.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-foreground-400 text-sm mb-4">{error}</p>
        <button onClick={loadSummary} className="bg-accent-500 text-background-950 px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground-50">UAT Testing Dashboard</h1>
        <p className="text-sm text-foreground-500 mt-1">DFP UAT pipeline — projects, testers, sessions, bug reports, and deployment approvals.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <SummaryCard label="Active Projects" value={summary?.projectsActive ?? 0} icon="ri-global-line" accent="bg-sky-500/10 text-sky-400" />
        <SummaryCard label="Open Bugs" value={summary?.openBugs ?? 0} icon="ri-bug-line" accent="bg-red-500/10 text-red-400" />
        <SummaryCard label="Active Testers" value={summary?.testersAvailable ?? 0} icon="ri-user-star-line" accent="bg-emerald-500/10 text-emerald-400" />
        <SummaryCard label="Active Sessions" value={summary?.sessionsActive ?? 0} icon="ri-timer-line" accent="bg-violet-500/10 text-violet-400" />
        <SummaryCard label="Pending Approvals" value={summary?.pendingApprovals ?? 0} icon="ri-shield-check-line" accent="bg-yellow-500/10 text-yellow-400" />
        <SummaryCard label="Tests Passed" value={summary?.testsPassed ?? 0} icon="ri-check-line" accent="bg-emerald-500/10 text-emerald-400" />
        <SummaryCard label="Tests Failed" value={summary?.testsFailed ?? 0} icon="ri-close-line" accent="bg-red-500/10 text-red-400" />
        <SummaryCard label="Ready for Deploy" value={summary?.readyForDeploy ?? 0} icon="ri-rocket-line" accent="bg-primary-500/10 text-primary-400" />
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-1 flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSearchParams({ tab: tab.key })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-accent-500/10 text-accent-400 font-medium'
                : 'text-foreground-400 hover:text-foreground-200 hover:bg-background-50'
            }`}
          >
            <i className={`${tab.icon} w-4 h-4 flex items-center justify-center`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'register' && <WebsiteRegisterTab />}
        {activeTab === 'changes' && <WebsiteChangesTab />}
        {activeTab === 'page-review' && <PageReviewTab />}
        {activeTab === 'link-checker' && <LinkCheckerTab />}
        {activeTab === 'image-manager' && <ImageManagerTab />}
        {activeTab === 'uat-runs' && <UatTestRunsTab />}
        {activeTab === 'approval' && <ApprovalQueueTab />}
      </div>
    </div>
  );
}