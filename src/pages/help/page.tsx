import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthGuard';
import {
  ROLE_BADGE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  SUPPORT_ROLES,
  type Role,
} from '@/lib/permissions';
import {
  ARTICLES,
  FIRST_PROJECT_CHECKLIST,
  FIRST_SUPPORT_TICKET_CHECKLIST,
  HELP_CATEGORIES,
  MODULE_GROUPS,
  PROJECT_DELIVERY_ARTICLES,
  ROLE_TABLE_DESCRIPTIONS,
  SUPPORT_ARTICLES,
  SUPPORT_CAPABILITIES,
  type HelpArticle,
  type HelpCategoryId,
  type HelpModule,
  type HelpModuleGroup,
} from './helpContent';
import FirstProjectChecklist from './components/FirstProjectChecklist';
import FirstSupportTicketChecklist from './components/FirstSupportTicketChecklist';
import ProjectDeliveryJourney from './components/ProjectDeliveryJourney';
import SupportPermissionsPanel from './components/SupportPermissionsPanel';
import SupportTicketJourney from './components/SupportTicketJourney';

function articleSearchText(a: HelpArticle): string {
  return [
    a.title,
    a.summary,
    ...a.keywords,
    ...(a.steps ?? []).flatMap((s) => [s.action, s.expected]),
    ...(a.points ?? []),
    ...(a.commonMistakes ?? []),
    ...(a.safetyRules ?? []),
    ...(a.relatedLinks ?? []).map((l) => l.label),
    a.note ?? '',
    a.warning ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${ROLE_BADGE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function RoleTable() {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-background-200/60">
      <div className="divide-y divide-background-200/40">
        {SUPPORT_ROLES.map((role) => (
          <div key={role} className="flex items-start gap-3 px-3 py-2.5 bg-background-50">
            <div className="w-28 shrink-0 pt-0.5">
              <RoleBadge role={role} />
            </div>
            <p className="text-xs text-foreground-300 leading-relaxed min-w-0">{ROLE_TABLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticleAccordion({ article, open, onToggle }: { article: HelpArticle; open: boolean; onToggle: () => void }) {
  const panelId = `article-${article.id}-panel`;
  const headerId = `article-${article.id}-header`;

  return (
    <div id={`article-${article.id}`} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <button
        type="button"
        id={headerId}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer hover:bg-background-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500/60"
      >
        <span className="flex items-start gap-3 min-w-0">
          <span className="w-6 h-6 rounded-md bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0 mt-0.5">
            <i className="ri-book-2-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground-100">{article.title}</span>
            <span className="block text-xs text-foreground-500 mt-0.5">{article.summary}</span>
          </span>
        </span>
        <i className={`${open ? 'ri-subtract-line' : 'ri-add-line'} text-foreground-400 text-base w-4 h-4 flex items-center justify-center shrink-0 mt-0.5`}></i>
      </button>

      {open && (
        <div id={panelId} role="region" aria-labelledby={headerId} className="px-4 pb-4 pt-1 border-t border-background-200/40">
          {article.warning && (
            <div className="flex items-start gap-2.5 mt-3 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <i className="ri-alert-line text-amber-400 text-sm w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
              <p className="text-xs text-amber-200 leading-relaxed">{article.warning}</p>
            </div>
          )}

          {article.steps && (
            <ol className="mt-3 space-y-2.5">
              {article.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-background-200 text-foreground-300 text-[11px] font-label flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground-200">{s.action}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{s.expected}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {article.points && (
            <ul className="mt-3 space-y-2">
              {article.points.map((p, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-400 shrink-0 mt-1.5"></span>
                  <p className="text-sm text-foreground-200 leading-relaxed">{p}</p>
                </li>
              ))}
            </ul>
          )}

          {article.safetyRules && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-label text-foreground-400 uppercase tracking-wide">Safety rules</p>
              <ul className="space-y-2">
                {article.safetyRules.map((r, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5"></span>
                    <p className="text-sm text-foreground-200 leading-relaxed">{r}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {article.commonMistakes && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-label text-foreground-400 uppercase tracking-wide">Common mistakes</p>
              <ul className="space-y-2">
                {article.commonMistakes.map((m, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5"></span>
                    <p className="text-sm text-foreground-200 leading-relaxed">{m}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {article.relatedLinks && article.relatedLinks.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {article.relatedLinks.map((l) => (
                <Link
                  key={l.route}
                  to={l.route}
                  className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-1 transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-right-up-line w-3 h-3 flex items-center justify-center"></i>
                  {l.label}
                </Link>
              ))}
            </div>
          )}

          {article.roleTable && <RoleTable />}

          {article.note && (
            <div className="flex items-start gap-2.5 mt-3 px-3 py-2.5 rounded-lg bg-background-50 border border-background-200/60">
              <i className="ri-information-line text-accent-400 text-sm w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
              <p className="text-xs text-foreground-300 leading-relaxed">{article.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleCard({ module }: { module: HelpModule }) {
  return (
    <Link
      to={module.route}
      className="group flex items-start gap-3 bg-background-100 border border-background-200/60 rounded-lg p-3.5 transition-colors hover:border-background-300/70 hover:bg-background-50 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500/60"
    >
      <span className="w-8 h-8 rounded-lg bg-background-200/60 text-foreground-300 group-hover:text-accent-400 flex items-center justify-center shrink-0">
        <i className={`${module.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground-100 whitespace-nowrap">{module.title}</span>
          <i className="ri-arrow-right-up-line text-foreground-600 group-hover:text-accent-400 text-xs w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"></i>
        </span>
        <span className="block text-xs text-foreground-500 mt-0.5 leading-relaxed">{module.description}</span>
      </span>
    </Link>
  );
}

function ModuleGroup({ group }: { group: HelpModuleGroup }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{group.title}</h3>
        <span className="text-[11px] font-label text-foreground-600">{group.modules.length} modules</span>
      </div>
      {group.description && <p className="text-xs text-foreground-500 leading-relaxed -mt-1">{group.description}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {group.modules.map((m) => (
          <ModuleCard key={m.title} module={m} />
        ))}
      </div>
    </section>
  );
}

export default function Help() {
  const auth = useAuth();
  const role = (auth.role ?? 'viewer') as Role;

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<HelpCategoryId>('start-here');
  const [openId, setOpenId] = useState<string | null>(ARTICLES[0]?.id ?? null);

  const search = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const allArticles = [...ARTICLES, ...PROJECT_DELIVERY_ARTICLES, ...SUPPORT_ARTICLES];
    const articles = allArticles.filter((a) => articleSearchText(a).includes(q));
    const modules: (HelpModule & { group: string })[] = [];
    for (const g of MODULE_GROUPS) {
      for (const m of g.modules) {
        if ((m.title + ' ' + m.description).toLowerCase().includes(q)) {
          modules.push({ ...m, group: g.title });
        }
      }
    }
    const projectChecklistHit = FIRST_PROJECT_CHECKLIST.some((item) => item.toLowerCase().includes(q));
    const supportChecklistHit = FIRST_SUPPORT_TICKET_CHECKLIST.some((item) => item.toLowerCase().includes(q));
    const permissionHit = SUPPORT_CAPABILITIES.some((c) => c.label.toLowerCase().includes(q));
    return { articles, modules, projectChecklistHit, supportChecklistHit, permissionHit };
  }, [query]);

  const toggleArticle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  const openArticle = (id: string) => {
    setOpenId(id);
    const isDelivery = PROJECT_DELIVERY_ARTICLES.some((a) => a.id === id);
    const isSupport = SUPPORT_ARTICLES.some((a) => a.id === id);
    setActiveCategory(isDelivery ? 'projects-delivery' : isSupport ? 'support-operations' : 'start-here');
    setQuery('');
    requestAnimationFrame(() => {
      document.getElementById(`article-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollToProjectChecklist = () => {
    setActiveCategory('projects-delivery');
    setQuery('');
    requestAnimationFrame(() => {
      document.getElementById('first-project-checklist')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollToSupportChecklist = () => {
    setActiveCategory('support-operations');
    setQuery('');
    requestAnimationFrame(() => {
      document.getElementById('first-support-ticket-checklist')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollToPermissions = () => {
    setActiveCategory('support-operations');
    setQuery('');
    requestAnimationFrame(() => {
      document.getElementById('support-permissions-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const activeGroup = MODULE_GROUPS.find((g) => g.id === activeCategory);
  const hasResults = search && (search.articles.length > 0 || search.modules.length > 0 || search.projectChecklistHit || search.supportChecklistHit || search.permissionHit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">DFP Command Help Centre</h1>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label rounded-full px-2 py-0.5 bg-accent-500/10 text-accent-400 border border-accent-500/25 whitespace-nowrap">
            <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Internal staff guide
          </span>
        </div>
        <p className="text-sm text-foreground-500 mt-1 max-w-3xl">
          Learn how to use DFP Command safely, manage your work and find the right tools for your role.
        </p>
      </div>

      {/* Role-aware welcome card */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold text-foreground-50">Welcome to DFP Command</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              <p className="text-foreground-300">
                <span className="text-foreground-500">Signed in as:</span> {auth.user?.email ?? '—'}
              </p>
              <p className="flex items-center gap-2 text-foreground-300">
                <span className="text-foreground-500">Your role:</span>
                <RoleBadge role={role} />
              </p>
              <p className="text-foreground-300">
                <span className="text-foreground-500">Role description:</span> {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          </div>
          <div className="w-12 h-12 bg-accent-500/10 rounded-xl flex items-center justify-center shrink-0">
            <i className="ri-question-line text-accent-400 text-xl w-6 h-6 flex items-center justify-center"></i>
          </div>
        </div>
      </div>

      {/* Search + category filters */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
        <div className="relative">
          <label htmlFor="help-search" className="sr-only">
            Search the Help Centre
          </label>
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            id="help-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the Help Centre…"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-10 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-foreground-500 hover:text-foreground-200 rounded-md transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-base w-4 h-4 flex items-center justify-center"></i>
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Help categories">
          {HELP_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id && !query;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                aria-pressed={active}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-label transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-accent-500 text-background-950 font-medium'
                    : 'bg-background-50 border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-background-400'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {search ? (
        hasResults ? (
          <div className="space-y-6">
            {search.articles.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Guides</h2>
                <div className="space-y-2.5">
                  {search.articles.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => openArticle(a.id)}
                      className="w-full text-left bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 hover:border-background-300/70 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500/60"
                    >
                      <p className="text-sm font-medium text-foreground-100">{a.title}</p>
                      <p className="text-xs text-foreground-500 mt-0.5">{a.summary}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {search.modules.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Modules</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {search.modules.map((m) => (
                    <ModuleCard key={m.title} module={m} />
                  ))}
                </div>
              </section>
            )}
            {(search.projectChecklistHit || search.supportChecklistHit) && (
              <section className="space-y-3">
                <h2 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Training checklist</h2>
                {search.projectChecklistHit && (
                  <button
                    type="button"
                    onClick={scrollToProjectChecklist}
                    className="w-full text-left bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 hover:border-background-300/70 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500/60"
                  >
                    <p className="text-sm font-medium text-foreground-100">Your First Project Checklist</p>
                    <p className="text-xs text-foreground-500 mt-0.5">A step-by-step training aid for running your first project.</p>
                  </button>
                )}
                {search.supportChecklistHit && (
                  <button
                    type="button"
                    onClick={scrollToSupportChecklist}
                    className="w-full text-left bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 hover:border-background-300/70 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500/60"
                  >
                    <p className="text-sm font-medium text-foreground-100">Your First Support Ticket Checklist</p>
                    <p className="text-xs text-foreground-500 mt-0.5">A step-by-step training aid for handling a support ticket safely.</p>
                  </button>
                )}
              </section>
            )}
            {search.permissionHit && (
              <section className="space-y-3">
                <h2 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Support permissions</h2>
                <button
                  type="button"
                  onClick={scrollToPermissions}
                  className="w-full text-left bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 hover:border-background-300/70 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500/60"
                >
                  <p className="text-sm font-medium text-foreground-100">Your Support Permissions</p>
                  <p className="text-xs text-foreground-500 mt-0.5">A live view of what your current role can do in Support Operations.</p>
                </button>
              </section>
            )}
          </div>
        ) : (
          <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-16 text-center">
            <i className="ri-search-eye-line text-2xl text-foreground-600 w-6 h-6 mx-auto flex items-center justify-center"></i>
            <p className="text-sm text-foreground-500 mt-2">No help topics match your search</p>
            <p className="text-[11px] font-label text-foreground-600 mt-1">Try a different keyword or clear the search.</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-4 bg-accent-500 text-background-950 px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer"
            >
              Clear search
            </button>
          </div>
        )
      ) : activeCategory === 'start-here' ? (
        <div className="space-y-8">
          {/* Start Here guides */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-heading font-semibold text-foreground-50">Start Here</h2>
              <span className="text-[11px] font-label text-foreground-600">{ARTICLES.length} guides</span>
            </div>
            <p className="text-xs text-foreground-500 leading-relaxed -mt-1">
              Essential guides for new DFP Command staff — access, MFA, navigation, roles and safety.
            </p>
            <div className="space-y-2.5">
              {ARTICLES.map((a) => (
                <ArticleAccordion key={a.id} article={a} open={openId === a.id} onToggle={() => toggleArticle(a.id)} />
              ))}
            </div>
          </section>

          {/* Module directory */}
          <section className="space-y-5">
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground-50">DFP Command directory</h2>
              <p className="text-xs text-foreground-500 leading-relaxed mt-1">
                A plain-English map of the main modules. Select a category above to focus on one area.
              </p>
            </div>
            {MODULE_GROUPS.map((g) => (
              <ModuleGroup key={g.id} group={g} />
            ))}
          </section>
        </div>
      ) : activeCategory === 'projects-delivery' ? (
        <div className="space-y-8">
          <ProjectDeliveryJourney onSelect={openArticle} />

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-heading font-semibold text-foreground-50">Projects & Delivery guides</h2>
              <span className="text-[11px] font-label text-foreground-600">{PROJECT_DELIVERY_ARTICLES.length} guides</span>
            </div>
            <p className="text-xs text-foreground-500 leading-relaxed -mt-1">
              Step-by-step guidance for taking a project from idea to launch readiness.
            </p>
            <div className="space-y-2.5">
              {PROJECT_DELIVERY_ARTICLES.map((a) => (
                <ArticleAccordion key={a.id} article={a} open={openId === a.id} onToggle={() => toggleArticle(a.id)} />
              ))}
            </div>
          </section>

          <FirstProjectChecklist />
        </div>
      ) : activeCategory === 'support-operations' ? (
        <div className="space-y-8">
          <SupportTicketJourney onSelect={openArticle} />

          <SupportPermissionsPanel />

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-heading font-semibold text-foreground-50">Support Operations guides</h2>
              <span className="text-[11px] font-label text-foreground-600">{SUPPORT_ARTICLES.length} guides</span>
            </div>
            <p className="text-xs text-foreground-500 leading-relaxed -mt-1">
              Step-by-step guidance for handling a support ticket safely from arrival to resolution.
            </p>
            <div className="space-y-2.5">
              {SUPPORT_ARTICLES.map((a) => (
                <ArticleAccordion key={a.id} article={a} open={openId === a.id} onToggle={() => toggleArticle(a.id)} />
              ))}
            </div>
          </section>

          <FirstSupportTicketChecklist />
        </div>
      ) : (
        <div className="space-y-5">{activeGroup && <ModuleGroup group={activeGroup} />}</div>
      )}
    </div>
  );
}