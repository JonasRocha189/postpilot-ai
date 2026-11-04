import ConfirmarExclusaoModal from "@/components/common/ConfirmarExclusaoModal";
import Portal from "@/components/common/Portal";
import { iconButtonDangerClass } from "@/components/common/styles";
import { Modal } from "@/components/ui/modal";
import { PlusIcon, TrashBinIcon } from "@/icons";
import { useFormat } from "@/lib/format";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useExcluirMetrica, useMetricas, useRegistrarMetrica } from "../api";
import { interacoes, taxaEngajamento } from "../calculo";
import { toMetricaInput, valoresIniciais } from "../schema";
import { CAMPOS_NUMERICOS, type Metrica } from "../types";
import MetricaForm from "./MetricaForm";

const DATA_HORA: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

/**
 * Métricas de uma variação salva: resumo do registro mais recente,
 * histórico de coletas e registro manual (só com o post publicado).
 */
export default function MetricasVariacao({
  variacaoId,
  publicado,
  dataPrevista,
}: {
  variacaoId: string;
  /** Status salvo do post é "published" */
  publicado: boolean;
  dataPrevista: string | null;
}) {
  const { t } = useTranslation("app", { keyPrefix: "metrics" });
  const fmt = useFormat();
  const metricas = useMetricas(variacaoId);
  const registrar = useRegistrarMetrica();
  const excluir = useExcluirMetrica();
  const [registrando, setRegistrando] = useState(false);
  const [aExcluir, setAExcluir] = useState<Metrica | null>(null);

  if (metricas.isLoading) {
    return (
      <div
        aria-hidden
        className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
      />
    );
  }
  if (metricas.isError) {
    return (
      <p role="alert" className="text-sm text-error-600 dark:text-error-400">
        {t("loadError")}
      </p>
    );
  }

  const registros = metricas.data ?? [];
  const ultima = registros[0];

  const resumo = ultima && [
    { label: t("fields.impressoes"), valor: fmt.number(ultima.impressoes) },
    { label: t("interactions"), valor: fmt.number(interacoes(ultima)) },
    { label: t("engagement"), valor: fmt.percent(taxaEngajamento(ultima)) },
  ];

  return (
    <div className="space-y-4">
      {ultima ? (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {resumo!.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800"
              >
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {item.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-gray-800 tabular-nums dark:text-white/90">
                  {item.valor}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("latest", {
              collected: fmt.date(ultima.coletado_em, DATA_HORA),
              published: fmt.date(ultima.publicado_em, DATA_HORA),
            })}
          </p>

          <div className="relative overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">{t("history")}</caption>
              <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-white/3 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t("collectedAt")}
                  </th>
                  {CAMPOS_NUMERICOS.map((campo) => (
                    <th
                      key={campo}
                      scope="col"
                      className="px-3 py-2 text-end font-medium"
                    >
                      {t(`fields.${campo}`)}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    {t("engagement")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">{t("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-800 dark:text-gray-300">
                {registros.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmt.date(m.coletado_em, DATA_HORA)}
                    </td>
                    {CAMPOS_NUMERICOS.map((campo) => (
                      <td
                        key={campo}
                        className="px-3 py-2 text-end tabular-nums"
                      >
                        {fmt.number(m[campo])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-end tabular-nums">
                      {fmt.percent(taxaEngajamento(m))}
                    </td>
                    <td className="px-3 py-1.5 text-end">
                      <button
                        type="button"
                        onClick={() => setAExcluir(m)}
                        aria-label={t("deleteLabel", {
                          date: fmt.date(m.coletado_em, DATA_HORA),
                        })}
                        className={`${iconButtonDangerClass} ms-auto size-8!`}
                      >
                        <TrashBinIcon className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {publicado ? t("empty") : t("notPublished")}
        </p>
      )}

      {publicado && (
        <button
          type="button"
          onClick={() => setRegistrando(true)}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-brand-200 ring-inset hover:bg-brand-50 dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/10"
        >
          <PlusIcon className="size-5" />
          {t("register")}
        </button>
      )}

      {/* Modais fora do <form> do post (ver Portal) */}
      <Portal>
        <Modal
          isOpen={registrando}
          onClose={() => setRegistrando(false)}
          className="m-4 max-w-[640px] p-6 sm:p-8"
        >
          <h3 className="mb-1 pe-10 text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("registerTitle")}
          </h3>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            {t("registerHint")}
          </p>
          {registrando && (
            <MetricaForm
              defaultValues={valoresIniciais(ultima, dataPrevista)}
              onCancel={() => setRegistrando(false)}
              onSubmit={async (values) => {
                await registrar.mutateAsync({
                  variacaoId,
                  input: toMetricaInput(values),
                });
                setRegistrando(false);
              }}
            />
          )}
        </Modal>

        <ConfirmarExclusaoModal
          isOpen={Boolean(aExcluir)}
          title={t("deleteTitle")}
          message={t("deleteMessage")}
          onConfirm={() => excluir.mutateAsync(aExcluir!.id)}
          onClose={() => setAExcluir(null)}
        />
      </Portal>
    </div>
  );
}
