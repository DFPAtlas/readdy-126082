import { useState } from 'react';
import { useTester } from '@/components/feature/TesterAuthGuard';
import { useTesterUat } from './hooks';
import SummaryCards from './components/SummaryCards';
import ProfileSummary from './components/ProfileSummary';
import Marketplace from './components/Marketplace';
import ActiveTab from './components/ActiveTab';
import PendingApprovalTab from './components/PendingApprovalTab';
import AwaitingReviewTab from './components/AwaitingReviewTab';
import CompletedTab from './components/CompletedTab';
import CancelledTab from './components/CancelledTab';
import EarningsTab from './components/EarningsTab';

const TABS = [
  { key: 'available', label: 'Available', icon: 'ri-compass-3-line' },
  { key: 'active', label: 'Active', icon: 'ri-play-circle-line' },
  { key: 'pending', label: 'Pending Approval', icon: 'ri-hourglass-line' },
  { key: 'review', label: 'Awaiting Review', icon: 'ri-time-line' },
  { key: 'completed', label: 'Completed', icon: 'ri-check-double-line' },
  { key: 'earnings', label: 'Earnings', icon: 'ri-money-pound-circle-line' },
  { key: 'cancelled', label: 'Cancelled', icon: 'ri-close-circle-line' },
];

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-40 bg-background-300/40 rounded"></div>
        <div className="h-3 w-64 bg-background-300/40 rounded"></div>
      </div>
      <div className="h-28 bg-background-300/30 rounded-lg"></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-background-300/30 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
}

export default function TesterUatDashboard() {
  const { tester } = useTester();
  const [tab, setTab] = useState('available');
  const data = useTesterUat(tester?.id ?? null);
  const currency = data.payments[0]?.currency ?? 'GBP';

  if (data.loading) {
    return <DashboardSkeleton />;
  }

  if (data.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-foreground-400 text-sm mb-4">{data.error}</p>
        <button
          onClick={data.reload}
          className="bg-accent-500 text-background-950 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const rating = {
    reliability: tester?.reliability_score ?? null,
    quality: tester?.quality_score ?? null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground-50">UAT Dashboard</h1>
        <p className="text-sm text-foreground-500 mt-1">Your tester account, assignments and earnings.</p>
      </div>

      {tester && (
        <ProfileSummary tester={tester} completedCount={data.completedAssignments.length} rating={rating} />
      )}

      <SummaryCards
        available={data.availableJobs.length}
        active={data.activeAssignments.length}
        review={data.awaitingReviewAssignments.length}
        completed={data.completedAssignments.length}
        earnings={data.earnings}
        currency={currency}
        onSelect={setTab}
      />

      <div className="flex gap-1 p-1 bg-background-100 border border-background-200/60 rounded-full overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors cursor-pointer ${
              tab === t.key ? 'bg-accent-500 text-background-950 font-medium' : 'text-foreground-400 hover:text-foreground-200'
            }`}
          >
            <i className={`${t.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'available' && <Marketplace jobs={data.availableJobs} projectById={data.projectById} tester={tester} />}
        {tab === 'active' && (
          <ActiveTab
            assignments={data.activeAssignments}
            jobById={data.jobById}
            projectById={data.projectById}
            progressByAssignment={data.progressByAssignment}
            lastActivityByAssignment={data.lastActivityByAssignment}
          />
        )}
        {tab === 'pending' && (
          <PendingApprovalTab
            pending={data.pendingApplications}
            rejected={data.rejectedApplications}
            jobById={data.jobById}
            projectById={data.projectById}
          />
        )}
        {tab === 'review' && (
          <AwaitingReviewTab
            assignments={data.awaitingReviewAssignments}
            jobById={data.jobById}
            projectById={data.projectById}
            resultSummaryByAssignment={data.resultSummaryByAssignment}
          />
        )}
        {tab === 'completed' && (
          <CompletedTab
            assignments={data.completedAssignments}
            payments={data.payments}
            jobById={data.jobById}
            projectById={data.projectById}
          />
        )}
        {tab === 'cancelled' && (
          <CancelledTab assignments={data.inactiveAssignments} jobById={data.jobById} projectById={data.projectById} />
        )}
        {tab === 'earnings' && (
          <EarningsTab
            payments={data.payments}
            jobById={data.jobById}
            assignmentById={data.assignmentById}
            earnings={data.earnings}
            currency={currency}
          />
        )}
      </div>
    </div>
  );
}