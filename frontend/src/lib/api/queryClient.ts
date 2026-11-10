import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./http";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Doesn't retry client errors (404, 409...), only network failures or 5xx
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});
