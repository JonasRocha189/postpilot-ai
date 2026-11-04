import type { TipoDocumento } from "./types";

/** Tamanho máximo por arquivo. O backend valida de novo ao gerar a URL de upload. */
export const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/** Content-Type de cada tipo aceito (o mesmo que o backend assina na URL do S3). */
export const MIME_POR_TIPO: Record<TipoDocumento, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

/** Formato aceito pelo react-dropzone. */
export const ACCEPT = {
  [MIME_POR_TIPO.pdf]: [".pdf"],
  [MIME_POR_TIPO.docx]: [".docx"],
  [MIME_POR_TIPO.txt]: [".txt"],
};

export function tipoDoArquivo(name: string): TipoDocumento | null {
  const extensao = name.split(".").pop()?.toLowerCase();
  return extensao === "pdf" || extensao === "docx" || extensao === "txt"
    ? extensao
    : null;
}
