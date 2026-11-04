import Portal from "@/components/common/Portal";
import { Modal } from "@/components/ui/modal";
import { ImageIcon } from "@/icons";
import { cn } from "@/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useImagens } from "../api";

/**
 * Escolha da imagem do post a partir da biblioteca do projeto.
 * `value` é o id da imagem ou "" (sem imagem).
 */
export default function SeletorImagem({
  projetoId,
  value,
  onChange,
}: {
  projetoId: string;
  value: string;
  onChange: (imagemId: string) => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "posts.form.image" });
  const imagens = useImagens(projetoId);
  const [aberto, setAberto] = useState(false);
  const selecionada = imagens.data?.find((i) => i.id === value);

  const escolher = (id: string) => {
    onChange(id);
    setAberto(false);
  };

  const botao =
    "rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition-colors";

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
        {t("label")}
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          {selecionada ? (
            <img
              src={selecionada.url}
              alt={selecionada.description ?? ""}
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-8 text-gray-400" aria-hidden />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selecionada
              ? (selecionada.description ?? t("selected"))
              : value && imagens.isLoading
                ? t("loading")
                : t("none")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAberto(true)}
              className={cn(
                botao,
                "text-brand-500 ring-brand-200 hover:bg-brand-50 dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/10",
              )}
            >
              {value ? t("change") : t("choose")}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className={cn(
                  botao,
                  "text-gray-600 ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/5",
                )}
              >
                {t("remove")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fora do <form> do post */}
      <Portal>
        <Modal
          isOpen={aberto}
          onClose={() => setAberto(false)}
          className="m-4 max-w-[760px] p-5 sm:p-6"
        >
          <h3 className="pe-8 text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("dialogTitle")}
          </h3>

          {imagens.isError ? (
            <p role="alert" className="mt-4 text-sm text-error-600">
              {t("loadError")}
            </p>
          ) : imagens.isLoading ? (
            <div
              aria-hidden
              className="mt-4 h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
            />
          ) : !imagens.data?.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("emptyLibrary")}
              </p>
              <Link
                to="/images"
                className="mt-3 inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                {t("goToLibrary")}
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-4 grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4">
                {imagens.data.map((imagem, i) => {
                  const ativa = imagem.id === value;
                  return (
                    <li key={imagem.id}>
                      <button
                        type="button"
                        onClick={() => escolher(imagem.id)}
                        aria-pressed={ativa}
                        aria-label={
                          imagem.description ?? t("option", { n: i + 1 })
                        }
                        className={cn(
                          "block aspect-square w-full overflow-hidden rounded-xl border-2 transition-colors",
                          ativa
                            ? "border-brand-500 ring-2 ring-brand-500/30"
                            : "border-transparent hover:border-brand-300",
                        )}
                      >
                        <img
                          src={imagem.url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Link
                to="/images"
                className="mt-4 inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                {t("uploadMore")}
              </Link>
            </>
          )}
        </Modal>
      </Portal>
    </div>
  );
}
