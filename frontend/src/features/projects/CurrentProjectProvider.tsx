import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useProjects } from "./api";
import { CurrentProjectContext } from "./currentProjectContext";

const STORAGE_KEY = "postpilot:projeto-atual";

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Keeps the project selected in the header and provides it to the pages. */
export default function CurrentProjectProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data, isLoading, isError } = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(readSaved);

  const projects = useMemo(() => data ?? [], [data]);
  // If the saved one no longer exists (e.g. it was deleted), use the first in the list
  const currentProject =
    projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable: the choice lasts only in this tab
    }
  }, []);

  const value = useMemo(
    () => ({ projects, currentProject, select, isLoading, isError }),
    [projects, currentProject, select, isLoading, isError],
  );

  return (
    <CurrentProjectContext.Provider value={value}>
      {children}
    </CurrentProjectContext.Provider>
  );
}
