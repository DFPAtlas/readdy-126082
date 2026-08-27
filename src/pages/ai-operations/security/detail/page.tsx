import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSecurity } from '@/pages/ai-operations/security/SecurityContext';
import { useAuth } from '@/components/feature/AuthGuard';
import { ROLE_LABELS } from '@/lib/permissions';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import PolicyHeader from '@/pages/ai-operations/security/detail/components/PolicyHeader';
import PolicyOverview from '@/pages/ai-operations/security/detail/components/PolicyOverview';
import ApprovalRequirements from '@/pages/ai-operations/security/detail/components/ApprovalRequirements';
import AppliesTo from '@/pages/ai-operations/security/detail/components/AppliesTo';
import Conditions from '@/pages/ai-operations/security/detail/components/Conditions';
import PolicyDecision from '@/pages/ai-operations/security/detail/components/PolicyDecision';
import Exceptions from '@/pages/ai-operations/security/detail/components/Exceptions';
import PolicyHistory from '@/pages/ai-operations/security/detail/components/PolicyHistory';
import PolicyFormModal from '@/pages/ai-operations/security/components/PolicyFormModal';

export default function PolicyDetailPage() {
  const { policyId } = useParams<{ policyId: string }>();
  const { mode, loading, sites, getPolicy, updatePolicy } = useSecurity();
  const { user, role } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const actor = user?.email ?? (role ? ROLE_LABELS[role] : 'Authenticated staff');
  const policy = getPolicy(policyId ?? '');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-background-200/60 rounded w-1/3 mb-3"></div>
          <div className="h-4 bg-background-200/60 rounded w-1/2"></div>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 animate-pulse">
          <div className="h-4 bg-background-200/60 rounded w-full mb-3"></div>
          <div className="h-4 bg-background-200/60 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-shield-check-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Policy not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested policy does not exist in the registry.</p>
        <Link
          to="/ai-operations/security"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to AI Security &amp; Policy
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PolicyHeader policy={policy} onEdit={() => setModalOpen(true)} />

      {/* Data-source distinction */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <DataSourceBadge mode={mode} />
        <p className="text-xs text-foreground-500">
          {mode === 'live'
            ? 'Live policy record — base metadata (name, category, effect, scope, risk, status, approval/audit requirement, review dates) is live. Target lists, structured conditions, decision explanation, exceptions and history remain demo supporting metadata until their tables exist.'
            : 'Demo policy record — all data is demo supporting metadata; nothing is written to Supabase.'}
        </p>
      </div>

      {/* Live-backed base record */}
      <PolicyOverview policy={policy} />
      <ApprovalRequirements policy={policy} />

      {/* Demo supporting metadata */}
      <div className="flex items-center gap-3 pt-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 whitespace-nowrap">
          <i className="ri-flask-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
          Demo Supporting Metadata
        </span>
        <div className="h-px flex-1 bg-background-200/60"></div>
      </div>

      <AppliesTo policy={policy} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Conditions policy={policy} />
        <PolicyDecision policy={policy} />
      </div>

      <Exceptions policy={policy} />
      <PolicyHistory policy={policy} />

      <PolicyFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        policy={policy}
        mode={mode}
        sites={sites}
        onSave={(record) => updatePolicy(policy.id, record, actor)}
      />
    </div>
  );
}