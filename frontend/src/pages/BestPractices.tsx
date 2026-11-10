import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import { cardClass } from "@/components/common/styles";
import {
  parseRatio,
  useContent,
  type Item,
} from "@/features/bestPractices/content";
import { CHAR_LIMIT_BY_NETWORK } from "@/features/posts/networks";
import { CheckLineIcon, InfoIcon } from "@/icons";
import { NETWORK_LABEL, type Network } from "@/lib/domain";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

const sectionTitle = "text-base font-semibold text-gray-800 dark:text-white/90";

function Section({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(cardClass, "p-5 sm:p-6", className)}
    >
      <h3 id={id} className={`${sectionTitle} mb-4`}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2.5 text-sm text-gray-600 dark:text-gray-400"
        >
          <CheckLineIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-success-500"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DefinitionList({ items }: { items: Item[] }) {
  return (
    <dl className="space-y-3">
      {items.map((item) => (
        <div key={item.name}>
          <dt className="text-sm font-medium text-gray-800 dark:text-white/90">
            {item.name}
          </dt>
          <dd className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {item.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Rectangle with the format's ratio (e.g. 4:5), inside a fixed box. */
function Ratio({ ratio }: { ratio: string }) {
  const r = parseRatio(ratio);
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center"
    >
      <span
        className="rounded-sm border-2 border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/15"
        style={
          r >= 1
            ? { width: "100%", aspectRatio: String(r) }
            : { height: "100%", aspectRatio: String(r) }
        }
      />
    </span>
  );
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/3">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
        {value}
      </p>
    </div>
  );
}

/** Tab order (Instagram first, the default tab). */
const TABS: readonly Network[] = ["instagram", "linkedin", "x"];

/** /best-practices: content creation guide per network (read-only). */
export default function BestPractices() {
  const { t } = useTranslation("app", { keyPrefix: "bestPractices" });
  const fmt = useFormat();
  const content = useContent();
  const [params, setParams] = useSearchParams();

  // ?network=… in the URL: a shareable link to each network's tab
  const param = params.get("network");
  const active: Network = TABS.includes(param as Network)
    ? (param as Network)
    : "instagram";
  const network = content.network(active);
  const s = (key: string) => t(`sections.${key}`);

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("metaDescription")}
      />
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section aria-labelledby="principios" className="mb-8">
        <h3 id="principios" className={`${sectionTitle} mb-4`}>
          {t("principlesTitle")}
        </h3>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {content.principles.map((p, i) => (
            <li key={p.title} className={cn(cardClass, "p-5")}>
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white/90">
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-theme-xs text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                  {i + 1}
                </span>
                {p.title}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {p.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-800"
      >
        {TABS.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            id={`aba-${r}`}
            aria-selected={r === active}
            aria-controls="painel-rede"
            onClick={() => setParams({ network: r }, { replace: true })}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              r === active
                ? "border-brand-500 text-brand-500 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            {NETWORK_LABEL[r]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="painel-rede"
        aria-labelledby={`aba-${active}`}
        className="space-y-6"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {network.summary}
        </p>

        <Section id="formatos" title={s("formats")}>
          <p className="-mt-2 mb-4 text-theme-xs text-gray-500 dark:text-gray-400">
            {s("formatsHint")}
          </p>
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-100 dark:border-gray-800">
                <tr className="text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  <th className="py-2 pe-4 text-start font-medium">
                    {s("format")}
                  </th>
                  <th className="py-2 pe-4 text-start font-medium">
                    {s("size")}
                  </th>
                  <th className="py-2 pe-4 text-start font-medium">
                    {s("ratio")}
                  </th>
                  <th className="hidden py-2 text-start font-medium md:table-cell">
                    {s("notes")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {network.formats.map((f) => (
                  <tr key={f.name} className="align-top text-sm">
                    <td className="py-3 pe-4">
                      <div className="flex items-start gap-3">
                        <Ratio ratio={f.ratio} />
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white/90">
                            {f.name}
                          </p>
                          {/* On mobile the notes column hides: the note shows here */}
                          <p className="mt-0.5 text-theme-xs text-gray-500 md:hidden dark:text-gray-400">
                            {f.note}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pe-4 whitespace-nowrap text-gray-700 tabular-nums dark:text-gray-300">
                      {f.size}
                    </td>
                    <td className="py-3 pe-4 text-gray-700 tabular-nums dark:text-gray-300">
                      {f.ratio}
                    </td>
                    <td className="hidden py-3 text-gray-500 md:table-cell dark:text-gray-400">
                      {f.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section id="texto" title={s("text")}>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Highlight
                label={s("limit")}
                value={t("sections.limitValue", {
                  limit: fmt.number(CHAR_LIMIT_BY_NETWORK[active]),
                })}
              />
              <Highlight label={s("visible")} value={network.text.visible} />
            </div>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-800 dark:text-white/90">
                {s("ideal")}:
              </span>{" "}
              {network.text.ideal}
            </p>
            <List items={network.text.tips} />
          </Section>

          <Section id="hashtags" title={s("hashtags")}>
            <div className="mb-4">
              <Highlight
                label={s("hashtagsCount")}
                value={network.hashtags.count}
              />
            </div>
            <List items={network.hashtags.tips} />
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section id="praticas" title={s("practices")}>
            <List items={network.practices} />
          </Section>

          <Section id="quando" title={s("timing")}>
            <List items={network.timing} />
            <Link
              to="/dashboard"
              className="mt-4 inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              {s("timingDashboard")}
            </Link>
          </Section>
        </div>

        <Section id="metricas" title={s("metrics")}>
          <DefinitionList items={network.metrics} />
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-white/3 dark:text-gray-400">
            <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {s("metricsFormula")}
          </p>
        </Section>

        <Section id="inspiracao" title={s("inspiration")}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {NETWORK_LABEL[active]}
              </h4>
              <DefinitionList items={network.inspiration} />
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {s("inspirationGeneral")}
              </h4>
              <DefinitionList items={content.generalInspiration} />
            </div>
          </div>
          <Link
            to="/agent?mode=ideation"
            className="mt-5 inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            {s("agentIdeation")}
          </Link>
        </Section>

        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {t("reviewed")}
        </p>
      </div>
    </>
  );
}
