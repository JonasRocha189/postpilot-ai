import AuthProvider from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import ExigeProjeto from "@/features/projetos/components/ExigeProjeto";
import AppLayout from "@/layout/AppLayout";
import Erro from "@/pages/OtherPage/Erro";
import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";

/** Carrega a página sob demanda (code splitting por rota). */
const page = (
  load: () => Promise<{ default: ComponentType }>,
): Pick<RouteObject, "lazy"> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

// Páginas de demonstração do TailAdmin, mantidas como referência visual.
// Remover antes da entrega.
const templateRoutes: RouteObject[] = [
  {
    path: "/template/ecommerce",
    ...page(() => import("@/pages/Dashboard/Ecommerce")),
  },
  { path: "/template/calendar", ...page(() => import("@/pages/Calendar")) },
  { path: "/template/profile", ...page(() => import("@/pages/UserProfiles")) },
  {
    path: "/template/form-elements",
    ...page(() => import("@/pages/Forms/FormElements")),
  },
  {
    path: "/template/basic-tables",
    ...page(() => import("@/pages/Tables/BasicTables")),
  },
  { path: "/template/blank", ...page(() => import("@/pages/OtherPage/Blank")) },
  {
    path: "/template/alerts",
    ...page(() => import("@/pages/UiElements/Alerts")),
  },
  {
    path: "/template/avatars",
    ...page(() => import("@/pages/UiElements/Avatars")),
  },
  {
    path: "/template/badge",
    ...page(() => import("@/pages/UiElements/Badges")),
  },
  {
    path: "/template/buttons",
    ...page(() => import("@/pages/UiElements/Buttons")),
  },
  {
    path: "/template/images",
    ...page(() => import("@/pages/UiElements/Images")),
  },
  {
    path: "/template/videos",
    ...page(() => import("@/pages/UiElements/Videos")),
  },
  {
    path: "/template/line-chart",
    ...page(() => import("@/pages/Charts/LineChart")),
  },
  {
    path: "/template/bar-chart",
    ...page(() => import("@/pages/Charts/BarChart")),
  },
];

const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    errorElement: <Erro />,
    children: [
      // Públicas
      { path: "/login", ...page(() => import("@/pages/AuthPages/Login")) },
      { path: "/signup", ...page(() => import("@/pages/AuthPages/Cadastro")) },
      { path: "/error", element: <Erro /> },

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
                ...page(() => import("@/pages/Projetos/Projetos")),
              },
              {
                path: "/projects/new",
                ...page(() => import("@/pages/Projetos/ProjetoFormPage")),
              },
              {
                path: "/projects/:id",
                ...page(() => import("@/pages/Projetos/ProjetoFormPage")),
              },
              { path: "/profile", ...page(() => import("@/pages/Perfil")) },
              // Só leitura e sem dados do projeto: fora do ExigeProjeto
              {
                path: "/best-practices",
                ...page(() => import("@/pages/BoasPraticas")),
              },

              // Conteúdo: exige um projeto selecionado
              {
                element: <ExigeProjeto />,
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
                  { path: "/images", ...page(() => import("@/pages/Imagens")) },
                  {
                    path: "/calendar",
                    ...page(() => import("@/pages/Calendario")),
                  },
                  {
                    path: "/subjects",
                    ...page(() => import("@/pages/Assuntos/Assuntos")),
                  },
                  {
                    path: "/subjects/new",
                    ...page(() => import("@/pages/Assuntos/AssuntoFormPage")),
                  },
                  {
                    path: "/subjects/:id",
                    ...page(() => import("@/pages/Assuntos/AssuntoFormPage")),
                  },
                  {
                    path: "/documents",
                    ...page(() => import("@/pages/Documentos")),
                  },
                  {
                    path: "/agent",
                    ...page(() => import("@/pages/Agente/Agente")),
                  },
                  {
                    path: "/agent/runs",
                    ...page(() => import("@/pages/Agente/Execucoes")),
                  },
                  {
                    path: "/agent/runs/:id",
                    ...page(() => import("@/pages/Agente/ExecucaoDetalhe")),
                  },
                ],
              },
              ...templateRoutes,
            ],
          },
        ],
      },

      // 404 na própria URL digitada
      { path: "*", ...page(() => import("@/pages/OtherPage/NotFound")) },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
