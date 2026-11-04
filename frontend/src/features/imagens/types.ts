// Espelha o schema do backend (tabela images; ver _docs/api.md).
// A imagem pertence à biblioteca do projeto; o post aponta para uma delas
// (Post.image_id).

export type TipoImagem = "png" | "jpeg" | "webp";

export type Imagem = {
  id: string;
  project_id: string;
  /** MIME type: image/png, image/jpeg ou image/webp */
  content_type: string;
  description: string | null;
  /** URL pré-assinada de leitura (expira; o banco guarda só a chave S3) */
  url: string;
  created_at: string;
  updated_at: string;
};

/** Resposta de POST /images/upload-url */
export type ImagemUploadUrlResponse = {
  key: string;
  /** URL pré-assinada do S3 para o PUT do arquivo */
  upload_url: string;
};
