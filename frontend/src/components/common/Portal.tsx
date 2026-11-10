import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders outside the current DOM tree (in <body>). Used by modals opened
 * from inside a <form>: in the DOM they aren't nested in the form, so the
 * modal's buttons and forms don't submit the outer one.
 * Note: React events still bubble up the component tree, so a <form> inside
 * the modal must call `e.stopPropagation()` on submit.
 */
export default function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
