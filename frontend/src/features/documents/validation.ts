import type { DocumentType } from "./types";

/** Maximum size per file. The backend checks again when it creates the upload URL. */
export const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/** Content-Type of each accepted type (the same one the backend signs into the S3 URL). */
export const MIME_BY_TYPE: Record<DocumentType, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

/** Format accepted by react-dropzone. */
export const ACCEPT = {
  [MIME_BY_TYPE.pdf]: [".pdf"],
  [MIME_BY_TYPE.docx]: [".docx"],
  [MIME_BY_TYPE.txt]: [".txt"],
};

export function fileType(name: string): DocumentType | null {
  const extension = name.split(".").pop()?.toLowerCase();
  return extension === "pdf" || extension === "docx" || extension === "txt"
    ? extension
    : null;
}
