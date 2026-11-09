import { useQuery } from "@tanstack/react-query";
import { checkHealth } from "./service";

export const healthKeys = { all: ["health"] as const };

/** The backend's health, checked every minute (and when the tab is focused again). */
export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: checkHealth,
    // checkHealth never throws: "offline" is a result, not an error
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.state === "demo" ? false : 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
