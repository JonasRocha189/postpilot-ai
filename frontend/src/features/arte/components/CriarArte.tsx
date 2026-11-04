import Portal from "@/components/common/Portal";
import { Modal } from "@/components/ui/modal";
import type { Imagem } from "@/features/imagens/types";
import { PencilIcon } from "@/icons";
import { REDE_LABEL, type Rede } from "@/lib/dominio";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import EditorArte from "./EditorArte";

/**
 * Botão "Criar arte" do formulário do post: abre o editor num modal e
 * devolve as imagens criadas (já salvas na biblioteca do projeto). Com
 * `maxSlides` acima de 1, o editor cria um carrossel.
 */
export default function CriarArte({
  projetoId,
  rede,
  textoInicial,
  maxSlides,
  onCriadas,
}: {
  projetoId: string;
  rede: Rede;
  /** Texto sugerido ao abrir (ex.: o título do post) */
  textoInicial: () => string;
  /** 1 = imagem única; acima disso, carrossel; 0 = o post já está cheio */
  maxSlides: number;
  onCriadas: (imagens: Imagem[]) => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "art" });
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const carrossel = maxSlides !== 1;

  const abrir = () => {
    setTexto(textoInicial());
    setAberto(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
          {carrossel ? t("ctaTitleCarousel") : t("ctaTitle")}
        </p>
        <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
          {!carrossel
            ? t("ctaHint", { network: REDE_LABEL[rede] })
            : maxSlides > 0
              ? t("ctaHintCarousel", {
                  network: REDE_LABEL[rede],
                  max: maxSlides,
                })
              : t("carouselFull")}
        </p>
      </div>
      <button
        type="button"
        onClick={abrir}
        disabled={maxSlides < 1}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-brand-200 ring-inset hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/10"
      >
        <PencilIcon aria-hidden className="size-4" />
        {t("open")}
      </button>

      {/* Fora do <form> do post */}
      <Portal>
        <Modal
          isOpen={aberto}
          onClose={() => setAberto(false)}
          // Mais alto que a tela: rola por dentro (centralizado, o topo ficaria inacessível)
          className="m-4 max-h-[calc(100dvh-2rem)] max-w-[1100px] overflow-y-auto p-5 sm:p-6"
        >
          {aberto && (
            <EditorArte
              projetoId={projetoId}
              rede={rede}
              textoInicial={texto}
              maxSlides={Math.max(1, maxSlides)}
              onCancelar={() => setAberto(false)}
              onCriadas={(imagens) => {
                setAberto(false);
                onCriadas(imagens);
              }}
            />
          )}
        </Modal>
      </Portal>
    </div>
  );
}
