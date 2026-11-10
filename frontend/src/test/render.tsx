import { AppWrapper } from "@/components/common/PageMeta";
import RequireProject from "@/features/projects/components/RequireProject";
import CurrentProjectProvider from "@/features/projects/CurrentProjectProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router";

/** Shows the current URL, so tests can assert navigation. */
function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location">{location.pathname + location.search}</div>
  );
}

/**
 * Renders a page like the app does: TanStack Query, router, page metadata and
 * the current project (ProjetoAtualProvider + ExigeProjeto). Data comes from
 * the fake API (MSW).
 */
export function renderPage(
  page: ReactNode,
  {
    path = "/",
    route = path,
    requireProject = true,
  }: { path?: string; route?: string; requireProject?: boolean } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <Outlet />
            <LocationDisplay />
          </>
        ),
        children: [
          {
            path,
            element: requireProject ? (
              <RequireProject>{page}</RequireProject>
            ) : (
              page
            ),
          },
          // Any other URL: the page navigated away (asserted via LocationDisplay)
          { path: "*", element: <p>other page</p> },
        ],
      },
    ],
    { initialEntries: [route] },
  );

  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <AppWrapper>
        <CurrentProjectProvider>
          <RouterProvider router={router} />
        </CurrentProjectProvider>
      </AppWrapper>
    </QueryClientProvider>,
  );
  return {
    user,
    router,
    location: () => screen.getByTestId("location").textContent,
  };
}
