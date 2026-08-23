import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthGuard';
import type { SupportSite, SupportSiteStats } from '@/types/support-tickets';
import { useIntegrationLookups, useSiteDetail, useSupportSites } from './hooks';
import { INTEGRATION_MODES, formatRelative } from './constants';
import SiteFormModal from './components/SiteFormModal';
import CredentialPanel from './components/CredentialPanel';
import SettingsPanel from './components/SettingsPanel';
import SlaPanel from './components/SlaPanel';
import RateLimitPanel from './components/RateLimitPanel';
import HealthPanel from './components/HealthPanel';
import SetupInstructionsModal from './components/SetupInstructionsModal';

type Tab = 'overview' | 'credentials' | 'settings' | 'sla' | 'rate-limits' | 'health';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: 'ri-information-line' },
  { id: 'credentials', label: 'Credentials', icon: 'ri-key-2-line' },
  { id: 'settings', label: 'Settings', icon: 'ri-settings-3-line' },
  { id: 'sla', label: 'SLA', icon: 'ri-timer-line' },
  { id: 'rate-limits', label: 'Rate limits', icon: 'ri-speed-mini-line' },
  { id: 'health', label: 'Health', icon: 'ri-pulse-line' },
];

function modeLabel(mode: string): string {
  return INTEGRATION_MODES.find((m) => m.value === mode)?.label ?? mode;
}

export default function SupportIntegrations() {
  const auth = useAuth();
  const navigate = useNavigate();

  const { sites, stats, loading, error, reload } = useSupportSites();
  const { staff, websites, projects } = useIntegrationLookups();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupportSite | null>(null);
  const [setupSite, setSetupSite] = useState<SupportSite | null>(null);

  const selected = useMemo(
    () => sites.find((s) => s.id === selectedId) ?? null,
    [sites, selectedId],
  );

  const detail = useSiteDetail(selected?.id ?? null);

  const websiteName = (id: string | null) => {
    if (!id) return null;
    return websites.find((w) => w.id === id)?.name ?? null;
  };
  const projectName = (id: number | null) => {
    if (id == null) return null;
    return projects.find((p) => p.id === id)?.project_name ?? null;
  };

  // ---- Route guard: owner/admin only ----
  if (auth.loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-[420px] text-center">
          <div className="w-16 h-16 bg-accent-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-cross-line text-accent-400 text-3xl w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground-50 mb-3">Access denied</h1>
          <p className="text-sm text-foreground-400 mb-8 leading-relaxed">
            Only owners and admins can manage support integrations.
          </p>
          <button
            onClick={() => navigate('/support-tickets', { replace: true })}
            className="w-full bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            Back to tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/support-tickets"
            className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
            Back to tickets
          </Link>
          <h1 className="text-2xl font-heading font-bold text-foreground-50 mt-1">Support integrations</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Register support-enabled websites, manage credentials and origins, and configure SLA and rate limits.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin/support-integrations/test-form"
            className="inline-flex items-center gap-1.5 border border-background-300/60 hover:border-accent-500/50 text-foreground-200 hover:text-accent-400 px-4 py-2.5 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-flask-line text-base w-4 h-4 flex items-center justify-center"></i>
            Test form
          </Link>
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line text-base w-4 h-4 flex items-center justify-center"></i>
            Register site
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={reload} className="text-sm text-red-300 underline cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
        {/* Site list */}
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-background-100 rounded-lg animate-pulse"></div>)}
            </div>
          ) : sites.length === 0 ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
                <i className="ri-global-line text-foreground-500 text-xl w-6 h-6 flex items-center justify-center"></i>
              </div>
              <p className="text-sm text-foreground-400">No support sites registered yet.</p>
              <p className="text-xs text-foreground-600 mt-1">Register your first site to start receiving tickets.</p>
            </div>
          ) : (
            sites.map((s) => {
              const st = stats[s.id];
              const active = s.is_active && !s.archived_at;
              const healthTone = !active ? 'text-red-400' : (st?.active_credential_count ?? 0) === 0 ? 'text-amber-400' : 'text-emerald-400';
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedId(s.id);
                    setTab('overview');
                  }}
                  className={`w-full text-left border rounded-lg p-4 transition-colors cursor-pointer ${
                    selected?.id === s.id
                      ? 'border-accent-500/50 bg-accent-500/5'
                      : 'border-background-200/60 bg-background-100 hover:border-background-300/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground-100 truncate">{s.site_name}</span>
                        <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-foreground-600/15 text-foreground-500'}`}>
                          {active ? 'Active' : s.archived_at ? 'Archived' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-foreground-500 mt-0.5 font-mono">{s.site_slug}</p>
                      {s.domain && <p className="text-xs text-foreground-500 truncate">{s.domain}</p>}
                    </div>
                    <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase bg-secondary-500/15 text-secondary-300 whitespace-nowrap shrink-0`}>
                      {modeLabel(s.integration_mode)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-foreground-500 flex-wrap gap-x-3 gap-y-1">
                    <span>{st?.active_credential_count ?? 0} credentials</span>
                    <span>{s.allowed_origins.length} origins</span>
                    <span className={healthTone}>
                      {st?.last_ticket_at ? `Last ticket ${formatRelative(st.last_ticket_at)}` : 'No tickets yet'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-background-200/60 flex items-center justify-center">
                <i className="ri-key-2-line text-foreground-500 text-2xl w-7 h-7 flex items-center justify-center"></i>
              </div>
              <h2 className="text-base font-semibold text-foreground-100">Select a site</h2>
              <p className="text-sm text-foreground-500 mt-1">Choose a site to manage its credentials, settings, SLA and health.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Site header */}
              <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="text-lg font-heading font-semibold text-foreground-50">{selected.site_name}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-foreground-500">
                      <span className="font-mono">{selected.site_slug}</span>
                      {selected.domain && <span>· {selected.domain}</span>}
                      {selected.support_email && <span>· {selected.support_email}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-foreground-500">
                      {websiteName(selected.website_id) && <span>Website: {websiteName(selected.website_id)}</span>}
                      {projectName(selected.project_id) && <span>Project: {projectName(selected.project_id)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSetupSite(selected)}
                      className="inline-flex items-center gap-1.5 border border-background-300/60 hover:border-accent-500/50 text-foreground-200 hover:text-accent-400 px-3.5 py-2 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-book-open-line text-base w-4 h-4 flex items-center justify-center"></i>
                      Setup
                    </button>
                    <button
                      onClick={() => {
                        setEditing(selected);
                        setFormOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 border border-background-300/60 hover:border-accent-500/50 text-foreground-200 hover:text-accent-400 px-3.5 py-2 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-pencil-line text-base w-4 h-4 flex items-center justify-center"></i>
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-background-100 border border-background-200/60 rounded-full p-1 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap ${
                      tab === t.id ? 'bg-accent-500 text-background-950 font-medium' : 'text-foreground-400 hover:text-foreground-200'
                    }`}
                  >
                    <i className={`${t.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
                {detail.loading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-background-200/50 rounded-lg animate-pulse"></div>)}
                  </div>
                ) : (
                  <>
                    {tab === 'overview' && (
                      <OverviewTab
                        site={selected}
                        stats={stats[selected.id]}
                        onOpenSetup={() => setSetupSite(selected)}
                      />
                    )}
                    {tab === 'credentials' && (
                      <CredentialPanel site={selected} credentials={detail.credentials} reload={detail.reload} />
                    )}
                    {tab === 'settings' && (
                      <SettingsPanel
                        siteId={selected.id}
                        siteName={selected.site_name}
                        settings={detail.settings}
                        staff={staff}
                        reload={detail.reload}
                      />
                    )}
                    {tab === 'sla' && (
                      <SlaPanel
                        siteId={selected.id}
                        siteName={selected.site_name}
                        globalRules={detail.globalSla}
                        siteRules={detail.siteSla}
                        reload={detail.reload}
                      />
                    )}
                    {tab === 'rate-limits' && (
                      <RateLimitPanel siteId={selected.id} siteName={selected.site_name} config={detail.rateLimit} reload={detail.reload} />
                    )}
                    {tab === 'health' && (
                      <HealthPanel site={selected} stats={stats[selected.id]} credentials={detail.credentials} />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SiteFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        websites={websites}
        projects={projects}
        onSaved={reload}
      />

      <SetupInstructionsModal open={!!setupSite} onClose={() => setSetupSite(null)} site={setupSite} />
    </div>
  );
}

function OverviewTab({ site, stats, onOpenSetup }: { site: SupportSite; stats: SupportSiteStats | undefined; onOpenSetup: () => void }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Site slug', value: site.site_slug },
    { label: 'Domain', value: site.domain ?? '—' },
    { label: 'Support email', value: site.support_email ?? '—' },
    { label: 'Integration mode', value: modeLabel(site.integration_mode) },
    { label: 'Status', value: site.is_active && !site.archived_at ? 'Active' : site.archived_at ? 'Archived' : 'Inactive' },
    { label: 'Tickets received', value: String(stats?.ticket_count ?? 0) },
    { label: 'Allowed origins', value: String(site.allowed_origins.length) },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-background-200/40">
            <span className="text-sm text-foreground-500">{r.label}</span>
            <span className="text-sm text-foreground-100 break-all text-right max-w-[60%]">{r.value}</span>
          </div>
        ))}
      </div>

      {site.allowed_origins.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-foreground-300 uppercase tracking-wider mb-1.5">Allowed origins</h4>
          <ul className="space-y-1">
            {site.allowed_origins.map((o) => (
              <li key={o} className="text-sm text-foreground-200 font-mono break-all">{o}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-accent-500/10 border border-accent-500/20 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-accent-400">Connect this site</h4>
        <p className="text-sm text-foreground-300 mt-1 leading-relaxed">
          Get the endpoint, required headers and example requests for this site's integration mode.
        </p>
        <button
          onClick={onOpenSetup}
          className="mt-3 inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-book-open-line text-base w-4 h-4 flex items-center justify-center"></i>
          View setup instructions
        </button>
      </div>
    </div>
  );
}