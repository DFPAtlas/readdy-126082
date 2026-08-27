import { useParams, Link } from 'react-router-dom';
import { useAudit } from '@/pages/ai-operations/audit/AuditContext';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import AuditHeader from '@/pages/ai-operations/audit/detail/components/AuditHeader';
import EventSummary from '@/pages/ai-operations/audit/detail/components/EventSummary';
import RelatedRecords from '@/pages/ai-operations/audit/detail/components/RelatedRecords';
import BeforeAfter from '@/pages/ai-operations/audit/detail/components/BeforeAfter';
import DecisionGovernance from '@/pages/ai-operations/audit/detail/components/DecisionGovernance';
import Evidence from '@/pages/ai-operations/audit/detail/components/Evidence';
import Verification from '@/pages/ai-operations/audit/detail/components/Verification';
import UatEvidence from '@/pages/ai-operations/audit/detail/components/UatEvidence';
import Integrity from '@/pages/ai-operations/audit/detail/components/Integrity';

export default function AuditDetailPage() {
  const { auditId } = useParams<{ auditId: string }>();
  const { mode, loading, error, refresh, loadDemo, getEvent } = useAudit();

  const event = getEvent(auditId ?? '');

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

  if (mode === 'error') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Audit Event</h1>
          <DataSourceBadge mode="error" />
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-xl mx-auto">
          <i className="ri-error-warning-line text-4xl text-amber-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
          <h2 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Live Audit &amp; Evidence unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2">{error}</p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <button
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
              Retry
            </button>
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-2 text-sm font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-4 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-flask-line w-4 h-4 flex items-center justify-center"></i>
              Use Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-file-list-3-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Audit event not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested audit event does not exist in the registry.</p>
        <Link
          to="/ai-operations/audit"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Audit &amp; Evidence
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data-source distinction */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <DataSourceBadge mode={mode} />
        <p className="text-xs text-foreground-500">
          {mode === 'live'
            ? 'Live audit event — base identity, outcome, severity, site/agent/run/approval linkage, before/after summaries and evidence are live. Nested decision/governance and verification/UAT detail remain demo supporting metadata until their tables exist.'
            : 'Demo audit event — all data is demo supporting metadata; nothing is written to Supabase.'}
        </p>
      </div>

      <AuditHeader event={event} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EventSummary event={event} />
        <RelatedRecords event={event} />
      </div>

      <BeforeAfter event={event} />

      <Evidence event={event} />

      <Integrity event={event} />

      {/* Demo supporting metadata */}
      <div className="flex items-center gap-3 pt-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 whitespace-nowrap">
          <i className="ri-flask-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
          Demo Supporting Metadata
        </span>
        <div className="h-px flex-1 bg-background-200/60"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DecisionGovernance event={event} />
        <div className="space-y-5">
          <Verification event={event} />
          <UatEvidence event={event} />
        </div>
      </div>
    </div>
  );
}