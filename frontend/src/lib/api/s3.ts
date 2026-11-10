import { ApiError } from "./http";

export type Progress = (fraction: number) => void;

/**
 * PUT straight to S3 with a URL presigned by the backend.
 * Uses XHR because fetch doesn't report upload progress.
 */
export function putNoS3(
  url: string,
  file: File,
  contentType: string,
  onProgress?: Progress,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, "Falha no envio para o S3"));
    xhr.onerror = () =>
      reject(new ApiError(0, "Falha de rede no envio para o S3"));
    xhr.send(file);
  });
}
