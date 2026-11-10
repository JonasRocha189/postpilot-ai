import { useContext } from "react";
import { CurrentProjectContext } from "./currentProjectContext";

export function useCurrentProject() {
  const context = useContext(CurrentProjectContext);
  if (context === undefined) {
    throw new Error(
      "useProjetoAtual must be used within a ProjetoAtualProvider",
    );
  }
  return context;
}
