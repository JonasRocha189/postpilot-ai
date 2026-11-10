import type { ImageFormat } from "@/lib/domain";
import type { ImageType } from "./types";

/** Maximum size per image. The backend checks again when it creates the upload URL. */
export const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const MIME_BY_TYPE: Record<ImageType, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Format accepted by react-dropzone. */
export const ACCEPT = {
  [MIME_BY_TYPE.png]: [".png"],
  [MIME_BY_TYPE.jpeg]: [".jpg", ".jpeg"],
  [MIME_BY_TYPE.webp]: [".webp"],
};

export function imageType(file: File): ImageType | null {
  const type = (Object.keys(MIME_BY_TYPE) as ImageType[]).find(
    (t) => MIME_BY_TYPE[t] === file.type,
  );
  return type ?? null;
}

const RATIO: Record<ImageFormat, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
};

/** Format closest to the image's dimensions (e.g. 1080×1350 → 4:5). */
export function closestFormat(width: number, height: number): ImageFormat {
  const ratio = width / height;
  return (Object.keys(RATIO) as ImageFormat[]).reduce((best, f) =>
    Math.abs(RATIO[f] - ratio) < Math.abs(RATIO[best] - ratio) ? f : best,
  );
}

/** Tailwind class with the format's ratio, for the thumbnail. */
export const ASPECT: Record<ImageFormat, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "16:9": "aspect-video",
};
