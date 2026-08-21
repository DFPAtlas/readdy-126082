import type { RouteObject } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/login/page";
import Signup from "@/pages/signup/page";
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
import WebsiteUatDashboard from "@/pages/admin/website-uat/page";

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
      { path: "admin/website-uat", element: <WebsiteUatDashboard /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;