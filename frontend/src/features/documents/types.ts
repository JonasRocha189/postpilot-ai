import type { DocumentStatus } from "@/lib/domain";

// Mirrors the backend schema (see _docs/modelo-de-dados.md and _docs/api.md)

export type DocumentType = "pdf" | "docx" | "txt";

/** A file uploaded to the project for the RAG ("Document" is taken by the DOM) */
export type ProjectDocument = {
  id: string;
  project_id: string;
  name: string;
  type: DocumentType;
  size_bytes: number;
  status: DocumentStatus;
  /** Filled in when status = "error" */
  error_message: string | null;
  /** How many chunks were indexed for the RAG (when ready) */
  chunk_count: number | null;
  created_at: string;
  updated_at: string;
};

/** Response of POST /documents/upload-url */
export type UploadUrlResponse = {
  document: ProjectDocument;
  /** Presigned S3 URL for the file's PUT */
  upload_url: string;
};
