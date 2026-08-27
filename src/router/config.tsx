import type { RouteObject } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/login/page";
import Signup from "@/pages/signup/page";
import MfaSetup from "@/pages/mfa/setup/page";
import MfaVerify from "@/pages/mfa/verify/page";
import AppLayout from "@/components/feature/AppLayout";
import Dashboard from "@/pages/dashboard/page";
import Projects from "@/pages/projects/page";
import ProjectDetail from "@/pages/projects/detail/page";
import Ideas from "@/pages/ideas/page";
import ChangeRequests from "@/pages/change-requests/page";
import Prompts from "@/pages/prompts/page";
import Bugs from "@/pages/bugs/page";
import Notes from "@/pages/notes/page";
import FilesLinks from "@/pages/files-links/page";
import Roadmap from "@/pages/roadmap/page";
import SystemStatus from "@/pages/system-status/page";
import BuildProcess from "@/pages/build-process/page";
import ProjectBudget from "@/pages/project-budget/page";
import ActivityLog from "@/pages/activity-log/page";
import TeamPage from "@/pages/team/page";
import Security from "@/pages/security/page";
import GitHubPage from "@/pages/github/page";
import Support from "@/pages/support/page";
import SupportTickets from "@/pages/support-tickets/page";
import SupportTicketDetail from "@/pages/support-tickets/detail/page";
import NotificationPreferences from "@/pages/support-tickets/preferences/page";
import SupportReports from "@/pages/support-tickets/reports/page";
import SupportCustomers from "@/pages/support-customers/page";
import Customer360Page from "@/pages/support-customers/detail/page";
import SupportRepairs from "@/pages/support-repairs/page";
import SupportSessionPage from "@/pages/support-session/page";
import SupportTeams from "@/pages/support-teams/page";
import SupportRouting from "@/pages/support-routing/page";
import SupportKnowledge from "@/pages/support-knowledge/page";
import WebsiteUatDashboard from "@/pages/admin/website-uat/page";
import SupportIntegrations from "@/pages/admin/support-integrations/page";
import SupportIntegrationTestForm from "@/pages/admin/support-integrations/test-form/page";
import UatAdminGuard from "@/components/feature/UatAdminGuard";
import AiOperationsPage from "@/pages/ai-operations/page";
import SitesLayout from "@/pages/ai-operations/sites/SitesLayout";
import SitesPage from "@/pages/ai-operations/sites/page";
import SiteDetailPage from "@/pages/ai-operations/sites/detail/page";
import AgentsLayout from "@/pages/ai-operations/agents/AgentsLayout";
import AgentsPage from "@/pages/ai-operations/agents/page";
import AgentDetailPage from "@/pages/ai-operations/agents/detail/page";
import RunsLayout from "@/pages/ai-operations/runs/RunsLayout";
import RunsPage from "@/pages/ai-operations/runs/page";
import RunDetailPage from "@/pages/ai-operations/runs/detail/page";
import ApprovalsLayout from "@/pages/ai-operations/approvals/ApprovalsLayout";
import ApprovalsPage from "@/pages/ai-operations/approvals/page";
import ApprovalDetailPage from "@/pages/ai-operations/approvals/detail/page";
import LiveOperationsPage from "@/pages/ai-operations/live/page";
import OrchestratorLayout from "@/pages/ai-operations/orchestrator/OrchestratorLayout";
import OrchestratorPage from "@/pages/ai-operations/orchestrator/page";
import OrchestratorDetailPage from "@/pages/ai-operations/orchestrator/detail/page";
import ToolsLayout from "@/pages/ai-operations/tools/ToolsLayout";
import ToolsPage from "@/pages/ai-operations/tools/page";
import ToolDetailPage from "@/pages/ai-operations/tools/detail/page";
import ModelsLayout from "@/pages/ai-operations/models/ModelsLayout";
import ModelsPage from "@/pages/ai-operations/models/page";
import ModelDetailPage from "@/pages/ai-operations/models/detail/page";
import KnowledgeLayout from "@/pages/ai-operations/knowledge/KnowledgeLayout";
import KnowledgePage from "@/pages/ai-operations/knowledge/page";
import KnowledgeDetailPage from "@/pages/ai-operations/knowledge/detail/page";
import SecurityLayout from "@/pages/ai-operations/security/SecurityLayout";
import SecurityPage from "@/pages/ai-operations/security/page";
import PolicyDetailPage from "@/pages/ai-operations/security/detail/page";
import AlertsLayout from "@/pages/ai-operations/alerts/AlertsLayout";
import AlertsPage from "@/pages/ai-operations/alerts/page";
import AlertDetailPage from "@/pages/ai-operations/alerts/detail/page";
import AuditLayout from "@/pages/ai-operations/audit/AuditLayout";
import AuditPage from "@/pages/ai-operations/audit/page";
import AuditDetailPage from "@/pages/ai-operations/audit/detail/page";
import CostsLayout from "@/pages/ai-operations/costs/CostsLayout";
import CostsPage from "@/pages/ai-operations/costs/page";
import BudgetsPage from "@/pages/ai-operations/costs/budgets/page";
import NotificationsLayout from "@/pages/ai-operations/notifications/NotificationsLayout";
import NotificationsPage from "@/pages/ai-operations/notifications/page";
import RuleDetailPage from "@/pages/ai-operations/notifications/detail/page";
import SchedulesLayout from "@/pages/ai-operations/schedules/SchedulesLayout";
import SchedulesPage from "@/pages/ai-operations/schedules/page";
import ScheduleDetailPage from "@/pages/ai-operations/schedules/detail/page";
import SearchPage from "@/pages/ai-operations/search/page";
import WallboardPage from "@/pages/ai-operations/wallboard/page";
import ReadinessPage from "@/pages/ai-operations/readiness/page";

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/mfa/setup",
    element: <MfaSetup />,
  },
  {
    path: "/mfa/verify",
    element: <MfaVerify />,
  },
  {
    path: "/support",
    element: <Support />,
  },
  {
    path: "/ai-operations/wallboard",
    element: <WallboardPage />,
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "projects", element: <Projects /> },
      { path: "projects/:slug", element: <ProjectDetail /> },
      { path: "ideas", element: <Ideas /> },
      { path: "change-requests", element: <ChangeRequests /> },
      { path: "prompts", element: <Prompts /> },
      { path: "bugs", element: <Bugs /> },
      { path: "notes", element: <Notes /> },
      { path: "files-links", element: <FilesLinks /> },
      { path: "roadmap", element: <Roadmap /> },
      { path: "build-process", element: <BuildProcess /> },
      { path: "project-budget", element: <ProjectBudget /> },
      { path: "system-status", element: <SystemStatus /> },
      { path: "activity-log", element: <ActivityLog /> },
      { path: "team", element: <TeamPage /> },
      { path: "security", element: <Security /> },
      { path: "github", element: <GitHubPage /> },
      { path: "support-tickets", element: <SupportTickets /> },
      { path: "support-tickets/preferences", element: <NotificationPreferences /> },
      { path: "support-tickets/reports", element: <SupportReports /> },
      { path: "support-tickets/:ticketId", element: <SupportTicketDetail /> },
      { path: "customers", element: <SupportCustomers /> },
      { path: "customers/:customerId", element: <Customer360Page /> },
      { path: "support-repairs", element: <SupportRepairs /> },
      { path: "support-session/:sessionId", element: <SupportSessionPage /> },
      { path: "support-teams", element: <SupportTeams /> },
      { path: "support-routing", element: <SupportRouting /> },
      { path: "support-knowledge", element: <SupportKnowledge /> },
      { path: "ai-operations", element: <AiOperationsPage /> },
      {
        path: "ai-operations/sites",
        element: <SitesLayout />,
        children: [
          { index: true, element: <SitesPage /> },
          { path: ":siteId", element: <SiteDetailPage /> },
        ],
      },
      {
        path: "ai-operations/agents",
        element: <AgentsLayout />,
        children: [
          { index: true, element: <AgentsPage /> },
          { path: ":agentId", element: <AgentDetailPage /> },
        ],
      },
      {
        path: "ai-operations/runs",
        element: <RunsLayout />,
        children: [
          { index: true, element: <RunsPage /> },
          { path: ":runId", element: <RunDetailPage /> },
        ],
      },
      {
        path: "ai-operations/approvals",
        element: <ApprovalsLayout />,
        children: [
          { index: true, element: <ApprovalsPage /> },
          { path: ":approvalId", element: <ApprovalDetailPage /> },
        ],
      },
      { path: "ai-operations/live", element: <LiveOperationsPage /> },
      {
        path: "ai-operations/orchestrator",
        element: <OrchestratorLayout />,
        children: [
          { index: true, element: <OrchestratorPage /> },
          { path: ":orchestrationId", element: <OrchestratorDetailPage /> },
        ],
      },
      {
        path: "ai-operations/tools",
        element: <ToolsLayout />,
        children: [
          { index: true, element: <ToolsPage /> },
          { path: ":connectionId", element: <ToolDetailPage /> },
        ],
      },
      {
        path: "ai-operations/models",
        element: <ModelsLayout />,
        children: [
          { index: true, element: <ModelsPage /> },
          { path: ":modelId", element: <ModelDetailPage /> },
        ],
      },
      {
        path: "ai-operations/knowledge",
        element: <KnowledgeLayout />,
        children: [
          { index: true, element: <KnowledgePage /> },
          { path: ":sourceId", element: <KnowledgeDetailPage /> },
        ],
      },
      {
        path: "ai-operations/security",
        element: <SecurityLayout />,
        children: [
          { index: true, element: <SecurityPage /> },
          { path: "policies/:policyId", element: <PolicyDetailPage /> },
        ],
      },
      {
        path: "ai-operations/alerts",
        element: <AlertsLayout />,
        children: [
          { index: true, element: <AlertsPage /> },
          { path: ":alertId", element: <AlertDetailPage /> },
        ],
      },
      {
        path: "ai-operations/audit",
        element: <AuditLayout />,
        children: [
          { index: true, element: <AuditPage /> },
          { path: ":auditId", element: <AuditDetailPage /> },
        ],
      },
      {
        path: "ai-operations/costs",
        element: <CostsLayout />,
        children: [
          { index: true, element: <CostsPage /> },
          { path: "budgets", element: <BudgetsPage /> },
        ],
      },
      {
        path: "ai-operations/notifications",
        element: <NotificationsLayout />,
        children: [
          { index: true, element: <NotificationsPage /> },
          { path: "rules/:ruleId", element: <RuleDetailPage /> },
        ],
      },
      {
        path: "ai-operations/schedules",
        element: <SchedulesLayout />,
        children: [
          { index: true, element: <SchedulesPage /> },
          { path: ":scheduleId", element: <ScheduleDetailPage /> },
        ],
      },
      { path: "ai-operations/search", element: <SearchPage /> },
      { path: "ai-operations/readiness", element: <ReadinessPage /> },
      { path: "command-centre/tickets", element: <SupportTickets /> },
      { path: "admin/website-uat", element: <UatAdminGuard><WebsiteUatDashboard /></UatAdminGuard> },
      { path: "admin/support-integrations", element: <SupportIntegrations /> },
      { path: "admin/support-integrations/test-form", element: <SupportIntegrationTestForm /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;