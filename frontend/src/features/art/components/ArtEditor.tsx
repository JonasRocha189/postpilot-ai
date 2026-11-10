import Button from "@/components/ui/button/Button";
import { useUploadImage, useImages } from "@/features/images/api";
import type { Image } from "@/features/images/types";
import {
  ChevronLeftIcon,
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  TrashBinIcon,
} from "@/icons";
import { NETWORK_LABEL, type Network } from "@/lib/domain";
import { cn } from "@/utils";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  textArea,
  downloadFiles,
  loadFont,
  loadImage,
  drawArt,
  exportSlide,
  type BackgroundImage,
} from "../canvas";
import {
  clampCenter,
  contrastingColor,
  coversArtwork,
  insideBox,
  imageArea,
  clampPoint,
  margin,
  ART_SIZES,
  ZOOM_MAX,
  ZOOM_MIN,
  type TextAlignment,
  type Art,
  type TextBox,
  type ImageBackground,
  type TextPoint,
  type TextPosition,
} from "../layout";

const BACKGROUND_COLORS = [
  "#465FFF",
  "#101828",
  "#FFFFFF",
  "#F2F4F7",
  "#F04438",
  "#F79009",
  "#12B76A",
  "#7A5AF8",
  "#EE46BC",
] as const;
const TEXT_COLORS = ["#FFFFFF", "#101828", "#FDB022", "#465FFF"] as const;
const ALIGNMENTS: readonly TextAlignment[] = ["left", "center", "right"];
const POSITIONS: readonly TextPosition[] = ["top", "middle", "bottom"];
const INITIAL_FIT: ImageBackground = {
  zoom: 1,
  x: 0.5,
  y: 0.5,
  darken: 0.3,
};
const INITIAL_FONT = 72;

const groupTitle = "mb-2 text-sm font-medium text-gray-700 dark:text-gray-400";

/** Group of exclusive options (radio) that look like buttons. */
function Segmented<T extends string>({
  caption,
  name,
  options,
  value,
  onChange,
  label,
}: {
  caption: string;
  name: string;
  options: readonly T[];
  /** null = no option checked */
  value: T | null;
  onChange: (v: T) => void;
  label: (v: T) => ReactNode;
}) {
  return (
    <fieldset>
      <legend className={groupTitle}>{caption}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o}
            className={cn(
              "cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-brand-500/20",
              o === value
                ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:text-gray-300",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o}
              checked={o === value}
              onChange={() => onChange(o)}
              className="sr-only"
            />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Amostras de cor + seletor livre. */
function Colors({
  caption,
  colors,
  value,
  onChange,
  otherLabel,
  colorLabel,
}: {
  caption: string;
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  otherLabel: string;
  colorLabel: (color: string) => string;
}) {
  return (
    <div role="group" aria-label={caption}>
      <p className={groupTitle}>{caption}</p>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={value.toUpperCase() === c}
            aria-label={colorLabel(c)}
            title={c}
            className={cn(
              "size-8 rounded-full border border-gray-300 dark:border-gray-700",
              value.toUpperCase() === c &&
                "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-gray-900",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        <label className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-400 text-xs text-gray-500 dark:border-gray-600">
          <span aria-hidden>+</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            aria-label={otherLabel}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

function Control({
  id,
  label,
  value,
  text,
  ...props
}: {
  id: string;
  label: string;
  value: number;
  /** Value shown next to the label */
  text: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <label htmlFor={id} className="text-gray-700 dark:text-gray-400">
          {label}
        </label>
        <span className="text-gray-500 tabular-nums dark:text-gray-400">
          {text}
        </span>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
    </div>
  );
}

type Slide = {
  /** Local id (never sent to the API) */
  id: string;
  backgroundType: "color" | "image";
  color: string;
  imageId: string | null;
  fit: ImageBackground;
  text: string;
  textColor: string;
  font: number;
  alignment: TextAlignment;
  position: TextPosition;
  /** Text dragged to a free spot; null = fixed position */
  point: TextPoint | null;
};

let sequence = 0;
const newId = () => `slide-${++sequence}`;

const initialSlide = (text: string): Slide => ({
  id: newId(),
  backgroundType: "color",
  color: BACKGROUND_COLORS[0],
  imageId: null,
  fit: INITIAL_FIT,
  text,
  textColor: contrastingColor(BACKGROUND_COLORS[0]),
  font: INITIAL_FONT,
  alignment: "center",
  position: "middle",
  point: null,
});

const slideButton =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-theme-xs font-medium text-gray-600 ring-1 ring-gray-200 ring-inset hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/3";

/** A slide's thumbnail (small canvas, redrawn on every change). */
function Thumbnail({
  art,
  background,
}: {
  art: Art;
  background: BackgroundImage | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // 2x the shown height (64 px), to stay sharp on high-density screens
  const scale = 128 / art.height;
  useEffect(() => {
    if (ref.current) drawArt(ref.current, art, background, scale);
  });
  return (
    <canvas
      ref={ref}
      aria-hidden
      width={Math.round(art.width * scale)}
      height={128}
      className="h-16 w-auto rounded-sm"
    />
  );
}

/**
 * Artwork editor: a single image (`maxSlides` = 1) or a carousel (several
 * slides of the same size). Each slide has a background (a color or a library
 * image, cropped to cover the artwork) and text in fixed positions.
 * "Use in post" exports the slides, uploads them to the library and returns
 * the images in order; "Download" only downloads the files.
 */
export default function ArtEditor({
  projectId,
  network,
  initialText,
  maxSlides,
  onCreated,
  onCancel,
}: {
  projectId: string;
  network: Network;
  initialText: string;
  /** 1 = single image; above that, a carousel with up to that many slides */
  maxSlides: number;
  onCreated: (images: Image[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "art" });
  const images = useImages(projectId);
  const send = useUploadImage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carousel = maxSlides > 1;

  const sizes = ART_SIZES[network];
  const [sizeIndex, setSizeIndex] = useState("0");
  const size = sizes[Number(sizeIndex)] ?? sizes[0];

  const [slides, setSlides] = useState<Slide[]>(() => [
    initialSlide(initialText),
  ]);
  const [active, setActive] = useState(0);
  const current = slides[active] ?? slides[0];

  // Decoded background images, by image id (shared between slides)
  const [bitmaps, setBitmaps] = useState<Record<string, BackgroundImage>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [withError, setWithError] = useState<Record<string, boolean>>({});
  const bitmapsRef = useRef(bitmaps);
  useEffect(() => {
    bitmapsRef.current = bitmaps;
  });
  // Frees the decoded images when the editor closes
  useEffect(
    () => () => Object.values(bitmapsRef.current).forEach((b) => b.close()),
    [],
  );

  const [fontReady, setFontReady] = useState(false);
  /** Slide being uploaded (1, 2, ...) or null */
  const [saving, setSaving] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  /** Slides already uploaded: retrying after an error doesn't upload them again */
  const sent = useRef(new Map<string, { signature: string; image: Image }>());

  const backgroundOf = (s: Slide) =>
    s.backgroundType === "image" && s.imageId
      ? (bitmaps[s.imageId] ?? null)
      : null;
  const artOf = (s: Slide): Art => ({
    width: size.width,
    height: size.height,
    color: s.color,
    image: backgroundOf(s) ? s.fit : null,
    text: s.text,
    textColor: s.textColor,
    font: s.font,
    alignment: s.alignment,
    position: s.position,
    point: s.point,
  });

  const background = backgroundOf(current);
  const art = artOf(current);
  const withPhoto = background !== null;
  // The background color shows when the image is smaller or moved aside
  const photoCover =
    background !== null &&
    coversArtwork(
      imageArea(
        { width: background.width, height: background.height },
        size,
        current.fit,
      ),
      size,
    );
  const initialFit =
    current.fit.zoom === INITIAL_FIT.zoom &&
    current.fit.x === INITIAL_FIT.x &&
    current.fit.y === INITIAL_FIT.y;
  const currentImage =
    current.backgroundType === "image" ? current.imageId : null;
  const loadingCurrent =
    currentImage !== null && Boolean(loading[currentImage]);
  const imageError = currentImage !== null && Boolean(withError[currentImage]);
  const anyLoading = Object.values(loading).some(Boolean);
  const busy = saving !== null || downloading || !fontReady || anyLoading;

  useEffect(() => {
    let live = true;
    void loadFont().then(() => live && setFontReady(true));
    return () => {
      live = false;
    };
  }, []);

  // Redraws on every change (the whole artwork takes a few milliseconds)
  useEffect(() => {
    if (canvasRef.current) drawArt(canvasRef.current, art, background);
  });

  /** Changes fields of the current slide. */
  const update = (partial: Partial<Slide>) =>
    setSlides((list) =>
      list.map((s, i) => (i === active ? { ...s, ...partial } : s)),
    );
  const setFit = (fit: ImageBackground) => update({ fit });

  const chooseColor = (color: string) =>
    update({ color, textColor: contrastingColor(color) });

  const chooseImage = async (image: Image) => {
    update({
      imageId: image.id,
      fit: INITIAL_FIT,
      textColor: "#FFFFFF",
    });
    if (bitmaps[image.id] || loading[image.id]) return;
    setWithError((e) => ({ ...e, [image.id]: false }));
    setLoading((c) => ({ ...c, [image.id]: true }));
    try {
      const bitmap = await loadImage(image.url);
      setBitmaps((b) => ({ ...b, [image.id]: bitmap }));
    } catch {
      setWithError((e) => ({ ...e, [image.id]: true }));
    } finally {
      setLoading((c) => ({ ...c, [image.id]: false }));
    }
  };

  // --- carousel slides -------------------------------------------------------
  const full = slides.length >= maxSlides;
  /** Inserts after the current one and switches to editing it. */
  const insert = (slide: Slide) => {
    if (full) return;
    setSlides((list) => [
      ...list.slice(0, active + 1),
      slide,
      ...list.slice(active + 1),
    ]);
    setActive(active + 1);
  };
  /** New slide with the current one's look and no text. */
  const addSlide = () => insert({ ...current, id: newId(), text: "" });
  const duplicateSlide = () => insert({ ...current, id: newId() });
  const removeSlide = () => {
    if (slides.length === 1) return;
    setSlides((list) => list.filter((_, i) => i !== active));
    setActive(Math.max(0, active - 1));
  };
  const moveSlide = (delta: number) => {
    const target = active + delta;
    if (target < 0 || target >= slides.length) return;
    setSlides((list) => {
      const newItem = [...list];
      const [item] = newItem.splice(active, 1);
      newItem.splice(target, 0, item);
      return newItem;
    });
    setActive(target);
  };

  // Dragging the preview: over the text, moves the text; elsewhere, moves the
  // background image (freely, like the text)
  const drag = useRef<
    | { type: "text"; x: number; y: number; box: TextBox }
    | { type: "image"; x: number; y: number; fit: ImageBackground }
    | null
  >(null);
  const [overText, setOverText] = useState(false);

  /** Pointer position in artwork pixels (the preview is scaled down by CSS). */
  const pointInArt = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const scale = r.width > 0 ? size.width / r.width : 1;
    return {
      x: (e.clientX - r.left) * scale,
      y: (e.clientY - r.top) * scale,
      scale,
    };
  };
  /** Text block under the pointer (with some slack, easier on mobile). */
  const textUnder = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = textArea(art);
    if (!box) return null;
    const p = pointInArt(e);
    // ~12 px of slack on screen, converted to artwork pixels
    return insideBox(box, p.x, p.y, 12 * p.scale) ? box : null;
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = textUnder(e);
    if (box) {
      drag.current = { type: "text", x: e.clientX, y: e.clientY, box };
    } else if (withPhoto) {
      drag.current = {
        type: "image",
        x: e.clientX,
        y: e.clientY,
        fit: current.fit,
      };
    } else {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const start = drag.current;
    if (!start) {
      // Not dragging: only changes the cursor when over the text
      const over = textUnder(e) !== null;
      if (over !== overText) setOverText(over);
      return;
    }
    const { scale } = pointInArt(e);
    const dx = (e.clientX - start.x) * scale;
    const dy = (e.clientY - start.y) * scale;

    if (start.type === "text") {
      const { box } = start;
      const center = {
        x: (box.left + box.width / 2 + dx) / size.width,
        y: (box.top + box.height / 2 + dy) / size.height,
      };
      update({
        point: clampPoint(center, size, box, margin(size)),
      });
      return;
    }

    // The image follows the pointer; its center stays inside the artwork
    setFit({
      ...start.fit,
      x: clampCenter(start.fit.x + dx / size.width),
      y: clampCenter(start.fit.y + dy / size.height),
    });
  };
  const dragEnd = () => {
    drag.current = null;
  };

  const descriptionOf = (s: Slide, i: number) =>
    s.text.trim().slice(0, 300) ||
    (carousel ? t("slideDescription", { n: i + 1 }) : t("defaultDescription"));

  const save = async () => {
    setSaveError(false);
    try {
      const createdTitles: Image[] = [];
      for (const [i, s] of slides.entries()) {
        setSaving(i + 1);
        const slideArt = artOf(s);
        const signature = JSON.stringify(slideArt) + (s.imageId ?? "");
        const previous = sent.current.get(s.id);
        if (previous?.signature === signature) {
          createdTitles.push(previous.image);
          continue;
        }
        const file = await exportSlide(slideArt, backgroundOf(s));
        const image = await send.mutateAsync({
          projectId,
          file,
          description: descriptionOf(s, i),
        });
        sent.current.set(s.id, { signature, image });
        createdTitles.push(image);
      }
      onCreated(createdTitles);
    } catch {
      setSaveError(true);
      setSaving(null);
    }
  };

  /** Only downloads the artwork (e.g. to publish outside PostPilot); nothing is saved. */
  const download = async () => {
    setDownloadError(false);
    setDownloading(true);
    try {
      const base = `postpilot-${network}-${size.width}x${size.height}`;
      const files: { file: File; name: string }[] = [];
      for (const [i, s] of slides.entries()) {
        const file = await exportSlide(artOf(s), backgroundOf(s));
        const extension = file.type === "image/png" ? "png" : "jpg";
        const numero = carousel ? `-${String(i + 1).padStart(2, "0")}` : "";
        files.push({ file, name: `${base}${numero}.${extension}` });
      }
      await downloadFiles(files);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const colorLabel = (c: string) => t("colorOption", { color: c });

  return (
    <div>
      <h3 className="pe-10 text-lg font-semibold text-gray-800 dark:text-white/90">
        {carousel
          ? t("titleCarousel", { network: NETWORK_LABEL[network] })
          : t("title", { network: NETWORK_LABEL[network] })}
      </h3>
      <p className="mt-1 pe-10 text-sm text-gray-500 dark:text-gray-400">
        {carousel ? t("subtitleCarousel", { max: maxSlides }) : t("subtitle")}
      </p>

      {carousel && (
        <div className="mt-5" role="group" aria-label={t("slides")}>
          <ol className="flex items-end gap-3 overflow-x-auto p-1">
            {slides.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={i === active ? "true" : undefined}
                  aria-label={t("slideN", { n: i + 1 })}
                  className={cn(
                    "relative block rounded-md border-2 p-0.5",
                    i === active
                      ? "border-brand-500"
                      : "border-transparent hover:border-brand-300",
                  )}
                >
                  <Thumbnail art={artOf(s)} background={backgroundOf(s)} />
                  <span className="absolute start-1 top-1 flex size-5 items-center justify-center rounded-full bg-gray-900/75 text-[10px] font-semibold text-white">
                    {i + 1}
                  </span>
                </button>
              </li>
            ))}
            <li className="shrink-0">
              <button
                type="button"
                onClick={addSlide}
                disabled={full}
                aria-label={t("addSlide")}
                title={t("addSlide")}
                className="flex h-[72px] w-14 items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-brand-500 hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-brand-400"
              >
                <PlusIcon aria-hidden className="size-5" />
              </button>
            </li>
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="me-auto text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
              {t("slideCount", {
                n: active + 1,
                total: slides.length,
                max: maxSlides,
              })}
            </p>
            <button
              type="button"
              className={slideButton}
              onClick={() => moveSlide(-1)}
              disabled={active === 0}
            >
              <ChevronLeftIcon aria-hidden className="size-4" />
              {t("moveSlideLeft")}
            </button>
            <button
              type="button"
              className={slideButton}
              onClick={() => moveSlide(1)}
              disabled={active === slides.length - 1}
            >
              {t("moveSlideRight")}
              <ChevronLeftIcon aria-hidden className="size-4 rotate-180" />
            </button>
            <button
              type="button"
              className={slideButton}
              onClick={duplicateSlide}
              disabled={full}
            >
              <CopyIcon aria-hidden className="size-4" />
              {t("duplicateSlide")}
            </button>
            <button
              type="button"
              className={slideButton}
              onClick={removeSlide}
              disabled={slides.length === 1}
            >
              <TrashBinIcon aria-hidden className="size-4" />
              {t("removeSlide")}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Full-size preview, scaled down by CSS */}
        <div className="flex min-h-64 items-center justify-center rounded-xl bg-gray-100 p-3 sm:p-4 dark:bg-gray-800/60">
          <canvas
            ref={canvasRef}
            width={size.width}
            height={size.height}
            role="img"
            aria-label={t("previewLabel", {
              size: `${size.width} × ${size.height}`,
            })}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={dragEnd}
            onPointerCancel={dragEnd}
            onPointerLeave={() => setOverText(false)}
            className={cn(
              "h-auto max-h-[45vh] w-auto max-w-full touch-none rounded-md shadow-theme-md lg:max-h-[65vh]",
              (withPhoto || overText) && "cursor-move",
            )}
          />
        </div>

        <div className="space-y-5">
          <Segmented
            caption={carousel ? t("sizeCarousel") : t("size")}
            name="arte-tamanho"
            options={sizes.map((_, i) => String(i))}
            value={sizeIndex}
            onChange={setSizeIndex}
            label={(i) => {
              const tm = sizes[Number(i)];
              return `${tm.width} × ${tm.height} · ${tm.ratio}`;
            }}
          />

          <Segmented
            caption={t("background")}
            name="arte-fundo"
            options={["color", "image"] as const}
            value={current.backgroundType}
            onChange={(backgroundType) => update({ backgroundType })}
            label={(o) => t(`backgroundTypes.${o}`)}
          />

          {current.backgroundType === "color" ? (
            <Colors
              caption={t("backgroundColor")}
              colors={BACKGROUND_COLORS}
              value={current.color}
              onChange={chooseColor}
              otherLabel={t("otherBackgroundColor")}
              colorLabel={colorLabel}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <p className={groupTitle}>{t("libraryImage")}</p>
                {images.isError ? (
                  <p role="alert" className="text-sm text-error-600">
                    {t("libraryError")}
                  </p>
                ) : images.isLoading ? (
                  <div
                    aria-hidden
                    className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                  />
                ) : !images.data?.length ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("emptyLibrary")}{" "}
                    <Link
                      to="/images"
                      className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      {t("goToLibrary")}
                    </Link>
                  </p>
                ) : (
                  <ul className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto p-0.5">
                    {images.data.map((image, i) => (
                      <li key={image.id}>
                        <button
                          type="button"
                          onClick={() => void chooseImage(image)}
                          aria-pressed={image.id === current.imageId}
                          aria-label={
                            image.description ?? t("imageOption", { n: i + 1 })
                          }
                          className={cn(
                            "block aspect-square w-full overflow-hidden rounded-lg border-2",
                            image.id === current.imageId
                              ? "border-brand-500"
                              : "border-transparent hover:border-brand-300",
                          )}
                        >
                          <img
                            src={image.url}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {loadingCurrent && (
                  <p role="status" className="mt-2 text-sm text-gray-500">
                    {t("loadingImage")}
                  </p>
                )}
                {imageError && (
                  <p role="alert" className="mt-2 text-sm text-error-600">
                    {t("imageError")}
                  </p>
                )}
              </div>

              {withPhoto && (
                <div className="space-y-3">
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("dragHint")}
                  </p>
                  <Control
                    id="arte-zoom"
                    label={t("zoom")}
                    value={current.fit.zoom}
                    text={pct(current.fit.zoom)}
                    min={ZOOM_MIN}
                    max={ZOOM_MAX}
                    step={0.05}
                    onChange={(zoom) => setFit({ ...current.fit, zoom })}
                  />
                  <Control
                    id="arte-imagem-x"
                    label={t("horizontal")}
                    value={current.fit.x}
                    text={pct(current.fit.x)}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(x) => setFit({ ...current.fit, x })}
                  />
                  <Control
                    id="arte-imagem-y"
                    label={t("vertical")}
                    value={current.fit.y}
                    text={pct(current.fit.y)}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(y) => setFit({ ...current.fit, y })}
                  />
                  <button
                    type="button"
                    className={slideButton}
                    disabled={initialFit}
                    onClick={() =>
                      setFit({
                        ...INITIAL_FIT,
                        darken: current.fit.darken,
                      })
                    }
                  >
                    {t("coverArtwork")}
                  </button>
                  <Control
                    id="arte-escurecer"
                    label={t("darken")}
                    value={current.fit.darken}
                    text={pct(current.fit.darken)}
                    min={0}
                    max={0.8}
                    step={0.05}
                    onChange={(darken) => setFit({ ...current.fit, darken })}
                  />
                  {!photoCover && (
                    // Color around the image (the text color stays: it sits on the photo)
                    <Colors
                      caption={t("colorAroundImage")}
                      colors={BACKGROUND_COLORS}
                      value={current.color}
                      onChange={(color) => update({ color })}
                      otherLabel={t("otherBackgroundColor")}
                      colorLabel={colorLabel}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-800">
            <div>
              <label htmlFor="arte-texto" className={`${groupTitle} block`}>
                {carousel ? t("slideText", { n: active + 1 }) : t("text")}
              </label>
              <textarea
                id="arte-texto"
                rows={3}
                value={current.text}
                onChange={(e) => update({ text: e.target.value })}
                placeholder={t("textPlaceholder")}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                {t("textHint")}
              </p>
            </div>
            <Control
              id="arte-fonte"
              label={t("fontSize")}
              value={current.font}
              text={`${current.font} px`}
              min={32}
              max={160}
              step={2}
              onChange={(font) => update({ font })}
            />
            <Colors
              caption={t("textColor")}
              colors={TEXT_COLORS}
              value={current.textColor}
              onChange={(textColor) => update({ textColor })}
              otherLabel={t("otherTextColor")}
              colorLabel={colorLabel}
            />
            <Segmented
              caption={t("align")}
              name="arte-alinhamento"
              options={ALIGNMENTS}
              value={current.alignment}
              onChange={(alignment) => update({ alignment })}
              label={(a) => t(`alignments.${a}`)}
            />
            <div>
              <Segmented
                caption={t("position")}
                name="arte-posicao"
                options={POSITIONS}
                // Dragged text: no fixed position checked
                value={current.point ? null : current.position}
                onChange={(position) => update({ position, point: null })}
                label={(p) => t(`positions.${p}`)}
              />
              <p
                aria-live="polite"
                className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400"
              >
                {current.point ? t("positionFree") : t("dragTextHint")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {(saveError || downloadError) && (
        <p role="alert" className="mt-5 text-sm text-error-600">
          {saveError ? t("saveError") : t("downloadError")}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void download()}
          disabled={busy}
          startIcon={<DownloadIcon aria-hidden className="size-5" />}
          className="sm:me-auto"
        >
          {downloading
            ? t("downloading")
            : carousel
              ? t("downloadSlides", { count: slides.length })
              : t("download")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="sm:min-w-40"
        >
          {saving !== null
            ? carousel
              ? t("savingSlides", { n: saving, total: slides.length })
              : t("saving")
            : carousel
              ? t("useSlides", { count: slides.length })
              : t("use")}
        </Button>
      </div>
    </div>
  );
}
