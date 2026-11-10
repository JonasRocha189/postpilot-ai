import Portal from "@/components/common/Portal";
import { Modal } from "@/components/ui/modal";
import type { Image } from "@/features/images/types";
import { PencilIcon } from "@/icons";
import { NETWORK_LABEL, type Network } from "@/lib/domain";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ArtEditor from "./ArtEditor";

/**
 * The post form's "Create artwork" button: opens the editor in a modal and
 * returns the images created (already saved in the project library). With
 * `maxSlides` above 1, the editor makes a carousel.
 */
export default function CreateArt({
  projectId,
  network,
  initialText,
  maxSlides,
  onCreated,
}: {
  projectId: string;
  network: Network;
  /** Text suggested on open (e.g. the post title) */
  initialText: () => string;
  /** 1 = single image; above that, a carousel; 0 = the post is already full */
  maxSlides: number;
  onCreated: (images: Image[]) => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "art" });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const carousel = maxSlides !== 1;

  const openDialog = () => {
    setText(initialText());
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
          {carousel ? t("ctaTitleCarousel") : t("ctaTitle")}
        </p>
        <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
          {!carousel
            ? t("ctaHint", { network: NETWORK_LABEL[network] })
            : maxSlides > 0
              ? t("ctaHintCarousel", {
                  network: NETWORK_LABEL[network],
                  max: maxSlides,
                })
              : t("carouselFull")}
        </p>
      </div>
      <button
        type="button"
        onClick={openDialog}
        disabled={maxSlides < 1}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-brand-200 ring-inset hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/10"
      >
        <PencilIcon aria-hidden className="size-4" />
        {t("open")}
      </button>

      {/* Outside the post's <form> */}
      <Portal>
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          // Taller than the screen: scrolls inside (if centered, the top would be unreachable)
          className="m-4 max-h-[calc(100dvh-2rem)] max-w-[1100px] overflow-y-auto p-5 sm:p-6"
        >
          {open && (
            <ArtEditor
              projectId={projectId}
              network={network}
              initialText={text}
              maxSlides={Math.max(1, maxSlides)}
              onCancel={() => setOpen(false)}
              onCreated={(images) => {
                setOpen(false);
                onCreated(images);
              }}
            />
          )}
        </Modal>
      </Portal>
    </div>
  );
}
