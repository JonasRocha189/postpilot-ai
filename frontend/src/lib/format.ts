import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** "YYYY-MM-DD" becomes a local date (new Date() would read it as UTC midnight and show the day before in Brazil). */
export function parseData(value: Date | string): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

/** Local date as "YYYY-MM-DD" (the API's format for dates without a time). */
export function isoDay(data: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

/** Number and date formatters in the interface's current language. */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return useMemo(() => {
    const numberFmt = new Intl.NumberFormat(locale);
    const percentFmt = new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const relativeFmt = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    });

    return {
      locale,
      number: (n: number) => numberFmt.format(n),
      percent: (n: number) => percentFmt.format(n),
      date: (value: Date | string, options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, options).format(parseData(value)),
      /** "5 minutes ago", "yesterday", "in 2 days"... */
      relative: (value: Date | string) => {
        const minutes = Math.round(
          (new Date(value).getTime() - Date.now()) / 60_000,
        );
        if (Math.abs(minutes) < 60)
          return relativeFmt.format(minutes, "minute");
        const hours = Math.round(minutes / 60);
        if (Math.abs(hours) < 24) return relativeFmt.format(hours, "hour");
        return relativeFmt.format(Math.round(hours / 24), "day");
      },
      /** Short weekday names, starting on Sunday. */
      weekdaysShort: () =>
        Array.from({ length: 7 }, (_, i) =>
          new Intl.DateTimeFormat(locale, { weekday: "short" })
            .format(new Date(2024, 0, 7 + i)) // 07/01/2024 foi domingo
            .replace(".", ""),
        ),
    };
  }, [locale]);
}
