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
                  { path: "/ideas", ...page(() => import("@/pages/Ideas")) },
                  {
                    path: "/metrics",
                    ...page(() => import("@/pages/Metrics")),
                  },
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
