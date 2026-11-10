// Mirrors the backend schema (images table; see _docs/api.md).
// The image belongs to the project library; posts point to them
// (Post.image_ids, in carousel order).

export type ImageType = "png" | "jpeg" | "webp";

export type Image = {
  id: string;
  project_id: string;
  /** MIME type: image/png, image/jpeg or image/webp */
  content_type: string;
  description: string | null;
  /** Presigned read URL (it expires; the database keeps only the S3 key) */
  url: string;
  created_at: string;
  updated_at: string;
};

/** Resposta de POST /images/upload-url */
export type ImageUploadUrlResponse = {
  key: string;
  /** Presigned S3 URL for the file's PUT */
  upload_url: string;
};
