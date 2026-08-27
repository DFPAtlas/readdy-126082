import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { SiteRegistryRecord } from '@/pages/ai-operations/types';
import { useSites } from '@/pages/ai-operations/sites/SitesContext';
import SiteHeader from '@/pages/ai-operations/sites/detail/components/SiteHeader';
import OverviewSection from '@/pages/ai-operations/sites/detail/components/OverviewSection';
import ConnectionsSection from '@/pages/ai-operations/sites/detail/components/ConnectionsSection';
import AgentsSection from '@/pages/ai-operations/sites/detail/components/AgentsSection';
import CapabilitiesSection from '@/pages/ai-operations/sites/detail/components/CapabilitiesSection';
import DependenciesSection from '@/pages/ai-operations/sites/detail/components/DependenciesSection';
import OwnershipSection from '@/pages/ai-operations/sites/detail/components/OwnershipSection';
import AiCostSummary from '@/pages/ai-operations/sites/detail/components/AiCostSummary';
import SiteFormModal from '@/pages/ai-operations/sites/components/SiteFormModal';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { sites, mode, loading, updateSite } = useSites();
  const [editOpen, setEditOpen] = useState(false);

  const site = sites.find((s) => s.id === siteId);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-background-100 border border-background-200/60 rounded-lg animate-pulse"></div>
        <div className="h-40 bg-background-100 border border-background-200/60 rounded-lg animate-pulse"></div>
        <div className="h-40 bg-background-100 border border-background-200/60 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-global-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Site not found</h1>
        <p className="text-sm text-foreground-500 mt-2">
          {mode === 'error'
            ? 'The live site registry is currently unavailable, so this site could not be loaded.'
            : 'The requested site does not exist in the registry.'}
        </p>
        <Link
          to="/ai-operations/sites"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Sites
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SiteHeader site={site} onEdit={() => setEditOpen(true)} />

      {/* Data-source distinction: live base record vs demo supporting metadata */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex items-start gap-3">
        <i className="ri-information-line text-sm text-foreground-500 w-5 h-5 flex items-center justify-center mt-0.5 shrink-0"></i>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground-200">
            {mode === 'live' ? 'Live Site Record' : 'Demo Data'}
          </p>
          <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
            {mode === 'live'
              ? 'Identity and base metadata are loaded from Supabase. Agent previews, connections, capabilities, dependencies, ownership and operational KPIs below are Demo Supporting Metadata until their production tables exist.'
              : 'Viewing the demo registry. This record is not stored in the live site registry.'}
          </p>
        </div>
        <DataSourceBadge mode={mode} />
      </div>

      <OverviewSection site={site} />
      <ConnectionsSection connections={site.connections} />
      <AgentsSection agents={site.agents} />
      <CapabilitiesSection capabilities={site.capabilities} />
      <DependenciesSection dependencies={site.dependencies} />
      <OwnershipSection ownership={site.ownership} />
      <AiCostSummary siteId={site.id} />

      <SiteFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        site={site}
        mode={mode}
        onSave={(record) => updateSite(site.id, record as SiteRegistryRecord)}
      />
    </div>
  );
}