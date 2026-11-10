import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import { alertErrorClass, cardClass } from "@/components/common/styles";
import DateField from "@/components/form/DateField";
import Button from "@/components/ui/button/Button";
import { useImportMetrics } from "@/features/metrics/api";
import {
  autoMatch,
  METRIC_FIELDS,
  readMetricsCsv,
  templateCsv,
  type Candidate,
  type ImportRow,
  type ReadResult,
} from "@/features/metrics/importRows";
import { usePosts } from "@/features/posts/api";
import { NETWORKS } from "@/features/posts/networks";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { DownloadIcon } from "@/icons";
import { NETWORK_LABEL, type Network } from "@/lib/domain";
import { isoDay, useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

const th =
  "px-3 py-2.5 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
const td =
  "px-3 py-2.5 align-middle text-theme-sm text-gray-700 dark:text-gray-300";

/** Saves a text file on the user's computer. */
function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Metrics import: the user exports the metrics from LinkedIn, Instagram or X
 * (CSV), the page reads the file in the browser, matches each row to a
 * published variation of that network (by date, or by hand) and imports them
 * all in one request.
 */
export default function Metrics() {
  const { t } = useTranslation("app", { keyPrefix: "metricsImport" });
  const { t: tApp } = useTranslation("app");
  const fmt = useFormat();
  const { currentProject } = useCurrentProject();
  const [params, setParams] = useSearchParams();
  const networkParam = params.get("network");
  const network: Network = NETWORKS.includes(networkParam as Network)
    ? (networkParam as Network)
    : "linkedin";

  const [read, setRead] = useState<ReadResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState(false);
  /** The user's choice per line ("" = skip); lines not chosen use the automatic match */
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [collectedOn, setCollectedOn] = useState(() => isoDay(new Date()));
  const [created, setCreated] = useState<number | null>(null);
  const [importError, setImportError] = useState(false);
  // Changing the key clears the file input after an import
  const [inputKey, setInputKey] = useState(0);
  const importMetrics = useImportMetrics();

  // Published variations of this network: what a row can be matched to
  const posts = usePosts(currentProject?.id, { network, status: "published" });
  const candidates = useMemo<Candidate[]>(
    () =>
      (posts.data ?? []).flatMap((post) =>
        post.variations
          .filter((v) => v.network === network && v.status === "published")
          .map((v) => ({ id: v.id, title: post.title, date: v.expected_date })),
      ),
    [posts.data, network],
  );

  const reset = () => {
    setRead(null);
    setFileName("");
    setFileError(false);
    setChoices({});
    setImportError(false);
    setInputKey((k) => k + 1);
  };

  const chooseNetwork = (next: Network) => {
    setParams(next === "linkedin" ? {} : { network: next }, { replace: true });
    setCreated(null);
    reset();
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCreated(null);
    setImportError(false);
    if (!file) return;
    try {
      const result = readMetricsCsv(await file.text());
      setRead(result);
      setFileName(file.name);
      setFileError(false);
      setChoices({});
    } catch {
      setRead(null);
      setFileError(true);
    }
  };

  /** Problems of the row, including a collection date before publishing. */
  const rowErrors = (row: ImportRow) =>
    row.publishedOn && collectedOn && row.publishedOn > collectedOn
      ? [...row.errors, "metricsImport.errors.collectedBeforePublished"]
      : row.errors;
  /**
   * Variation of each line: the user's choice, or the one published that day.
   * Computed on every render, so it also works when the posts load after the file.
   */
  const matchOf = (row: ImportRow) =>
    choices[row.line] ?? autoMatch(row, candidates) ?? "";
  const rows = read?.rows ?? [];
  const ready = rows.filter((r) => rowErrors(r).length === 0 && matchOf(r));
  const withErrors = rows.filter((r) => rowErrors(r).length > 0).length;

  const submit = async () => {
    setImportError(false);
    try {
      const result = await importMetrics.mutateAsync({
        network,
        collected_at: `${collectedOn}T12:00:00Z`,
        rows: ready.map((r) => ({
          variation_id: matchOf(r),
          // With the file's time when it has one (noon UTC for a date alone)
          published_at: r.publishedAt!,
          ...r.values,
        })),
      });
      setCreated(result.created);
      reset();
    } catch {
      setImportError(true);
    }
  };

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("subtitle")}
      />
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div
        role="group"
        aria-label={t("network")}
        className="mb-5 inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900"
      >
        {NETWORKS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={network === n}
            onClick={() => chooseNetwork(n)}
            className={cn(
              "rounded-md px-4 py-2 text-theme-sm font-medium",
              network === n
                ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            {NETWORK_LABEL[n]}
          </button>
        ))}
      </div>

      {created !== null && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-success-500 bg-success-50 p-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-400"
        >
          {t("imported", { count: created })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={`${cardClass} p-5 sm:p-6`}>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("step1", { network: NETWORK_LABEL[network] })}
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t(`howTo.${network}`)}
          </p>
          <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
            {t("columnsHint")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            startIcon={<DownloadIcon aria-hidden className="size-4" />}
            onClick={() =>
              downloadText(
                templateCsv(network),
                `postpilot-metricas-${network}.csv`,
              )
            }
          >
            {t("template")}
          </Button>
        </section>

        <section className={`${cardClass} p-5 sm:p-6`}>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("step2")}
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="metrics-file"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
              >
                {t("file", { network: NETWORK_LABEL[network] })}
              </label>
              <input
                key={inputKey}
                id="metrics-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onFile(e)}
                className="block w-full text-sm text-gray-700 file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-brand-600 hover:file:bg-brand-100 dark:text-gray-300 dark:file:bg-brand-500/15 dark:file:text-brand-400"
              />
            </div>
            <DateField
              id="metrics-collected"
              label={t("collectedOn")}
              value={collectedOn}
              onChange={setCollectedOn}
            />
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t("collectedHint")}
            </p>
          </div>
        </section>
      </div>

      {fileError && (
        <p role="alert" className={`${alertErrorClass} mt-5`}>
          {t("readError")}
        </p>
      )}
      {read && read.missing.length > 0 && (
        <p role="alert" className={`${alertErrorClass} mt-5`}>
          {t("missingColumns", { columns: read.missing.join(", ") })}
        </p>
      )}

      {read && read.missing.length === 0 && (
        <section className={`${cardClass} mt-5 overflow-hidden`}>
          <div className="p-5 sm:p-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              {t("step3")}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t("summary", {
                file: fileName,
                rows: rows.length,
                ready: ready.length,
                errors: withErrors,
              })}
            </p>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {candidates.length
                ? t("matchHint", { network: NETWORK_LABEL[network] })
                : t("noCandidates", { network: NETWORK_LABEL[network] })}
            </p>
          </div>
          <div className="max-w-full overflow-x-auto border-t border-gray-100 dark:border-gray-800">
            <table className="min-w-full">
              <thead className="border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className={th}>{t("columns.line")}</th>
                  <th className={th}>{t("columns.date")}</th>
                  <th className={th}>{t("columns.post")}</th>
                  {METRIC_FIELDS.map((f) => (
                    <th key={f} className={`${th} text-end`}>
                      {t(`fields.${f}`)}
                    </th>
                  ))}
                  <th className={th}>{t("columns.match")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((row) => {
                  const errors = rowErrors(row);
                  return (
                    <tr
                      key={row.line}
                      className={cn(
                        errors.length && "bg-error-50/50 dark:bg-error-500/5",
                      )}
                    >
                      <td className={`${td} tabular-nums`}>{row.line}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {row.publishedOn
                          ? fmt.date(row.publishedOn, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td
                        className={`${td} max-w-56 truncate`}
                        title={row.label}
                      >
                        {row.label || "—"}
                      </td>
                      {METRIC_FIELDS.map((f) => (
                        <td key={f} className={`${td} text-end tabular-nums`}>
                          {fmt.number(row.values[f])}
                        </td>
                      ))}
                      <td className={`${td} min-w-64`}>
                        {errors.length ? (
                          <p
                            role="alert"
                            className="text-theme-xs text-error-600 dark:text-error-400"
                          >
                            {errors.map((e) => tApp(e)).join(" ")}
                          </p>
                        ) : (
                          <select
                            aria-label={t("matchLabel", { line: row.line })}
                            value={matchOf(row)}
                            onChange={(e) =>
                              setChoices((m) => ({
                                ...m,
                                [row.line]: e.target.value,
                              }))
                            }
                            className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-theme-sm text-gray-800 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                          >
                            <option value="">{t("skip")}</option>
                            {candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.date
                                  ? `${c.title} · ${fmt.date(c.date, { day: "2-digit", month: "short" })}`
                                  : c.title}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-end dark:border-gray-800">
            {importError && (
              <p role="alert" className="text-sm text-error-600 sm:me-auto">
                {t("importError")}
              </p>
            )}
            <Button variant="outline" onClick={reset}>
              {t("discard")}
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={ready.length === 0 || importMetrics.isPending}
            >
              {importMetrics.isPending
                ? t("importing")
                : t("import", { count: ready.length })}
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
