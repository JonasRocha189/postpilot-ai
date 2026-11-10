import { createContext } from "react";
import type { Project } from "./types";

export type CurrentProjectState = {
  /** The user's projects (empty while loading) */
  projects: Project[];
  /** Project selected in the header; null when there are no projects */
  currentProject: Project | null;
  select: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
};

export const CurrentProjectContext = createContext<
  CurrentProjectState | undefined
>(undefined);
