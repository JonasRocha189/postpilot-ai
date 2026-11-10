import AuthProvider from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireProject from "@/features/projects/components/RequireProject";
import AppLayout from "@/layout/AppLayout";
import ErrorPage from "@/pages/OtherPage/ErrorPage";
import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";

/** Loads the page on demand (code splitting per route). */
const page = (
  load: () => Promise<{ default: ComponentType }>,
): Pick<RouteObject, "lazy"> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    errorElement: <ErrorPage />,
    children: [
      // Public
      { path: "/login", ...page(() => import("@/pages/AuthPages/Login")) },
      { path: "/signup", ...page(() => import("@/pages/AuthPages/SignUp")) },
      { path: "/error", element: <ErrorPage /> },

      // Protegidas
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              {
                path: "/projects",
                ...page(() => import("@/pages/Projects/Projects")),
              },
              {
                path: "/projects/new",
                ...page(() => import("@/pages/Projects/ProjectFormPage")),
              },
              {
                path: "/projects/:id",
                ...page(() => import("@/pages/Projects/ProjectFormPage")),
              },
              { path: "/profile", ...page(() => import("@/pages/Profile")) },
              // Read-only and without project data: outside RequireProject
              {
                path: "/best-practices",
                ...page(() => import("@/pages/BestPractices")),
              },

              // Content: needs a selected project
              {
                element: <RequireProject />,
                children: [
                  {
                    path: "/dashboard",
                    ...page(() => import("@/pages/Dashboard/Dashboard")),
                  },
                  {
                    path: "/posts",
                    ...page(() => import("@/pages/Posts/Posts")),
                  },
                  {
                    path: "/posts/new",
                    ...page(() => import("@/pages/Posts/PostFormPage")),
                  },
                  {
                    path: "/posts/:id",
                    ...page(() => import("@/pages/Posts/PostFormPage")),
                  },
                  { path: "/images", ...page(() => import("@/pages/Images")) },
                  { path: "/ideas", ...page(() => import("@/pages/Ideas")) },
                  {
                    path: "/metrics",
                    ...page(() => import("@/pages/Metrics")),
                  },
                  {
                    path: "/calendar",
                    ...page(() => import("@/pages/Calendar")),
                  },
                  {
                    path: "/subjects",
                    ...page(() => import("@/pages/Subjects/Subjects")),
                  },
                  {
                    path: "/subjects/new",
                    ...page(() => import("@/pages/Subjects/SubjectFormPage")),
                  },
                  {
                    path: "/subjects/:id",
                    ...page(() => import("@/pages/Subjects/SubjectFormPage")),
                  },
                  {
                    path: "/documents",
                    ...page(() => import("@/pages/Documents")),
                  },
                  {
                    path: "/agent",
                    ...page(() => import("@/pages/Agent/Agent")),
                  },
                  {
                    path: "/agent/runs",
                    ...page(() => import("@/pages/Agent/Runs")),
                  },
                  {
                    path: "/agent/runs/:id",
                    ...page(() => import("@/pages/Agent/RunDetail")),
                  },
                ],
              },
            ],
          },
        ],
      },

      // 404 on the typed URL itself
      { path: "*", ...page(() => import("@/pages/OtherPage/NotFound")) },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
