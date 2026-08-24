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