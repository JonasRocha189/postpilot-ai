import CalendarEventItem from "@/components/calendar/CalendarEventItem";
import {
  BookmarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@/components/calendar/icons";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import type {
  DatesSetInfo,
  DayCellInfo,
  DayHeaderInfo,
  EventClickInfo,
  EventDisplayInfo,
  EventInput,
  MoreLinkInfo,
} from "@fullcalendar/react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import ptBrLocale from "@fullcalendar/react/locales/pt-br";
import "@fullcalendar/react/skeleton.css";
import themePlugin from "@fullcalendar/react/themes/classic";
import "@fullcalendar/react/themes/classic/palette.css";
import "@fullcalendar/react/themes/classic/theme.css";
import { NETWORK_LABEL } from "@/lib/domain";
import { isoDay } from "@/lib/format";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { STATUS_LEVEL } from "../status";
import type { ScheduledPost } from "../types";

const NAV_BUTTON =
  "flex size-9! sm:size-10! p-0! items-center justify-center! rounded-lg! border! bg-transparent! border-gray-200! text-gray-700 hover:border-gray-200 hover:bg-gray-50! focus:shadow-none active:border-gray-200! active:bg-transparent! active:shadow-none! dark:border-gray-800! dark:text-gray-400 dark:hover:border-gray-800 dark:hover:bg-gray-900! dark:active:border-gray-800!";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

export default function PostsCalendar({
  posts,
  onSelect,
  onRangeChange,
}: {
  posts: ScheduledPost[];
  onSelect: (post: ScheduledPost) => void;
  /** Visible period (inclusive, "YYYY-MM-DD"), to fetch only its posts */
  onRangeChange?: (range: { from: string; to: string }) => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "calendar" });
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  const events: EventInput[] = posts.map((post) => ({
    id: post.id,
    // Same post on several networks: the network tells the events apart
    title: `${post.title} · ${NETWORK_LABEL[post.network]}`,
    start: post.expectedDate,
    allDay: true,
    extendedProps: { calendar: STATUS_LEVEL[post.status] },
  }));

  // FullCalendar's end is exclusive: the last visible day is the one before
  const handleDatesSet = (info: DatesSetInfo) => {
    const last = new Date(info.end);
    last.setDate(last.getDate() - 1);
    onRangeChange?.({ from: isoDay(info.start), to: isoDay(last) });
  };

  const handleEventClick = (info: EventClickInfo) => {
    const post = posts.find((p) => p.id === info.event.id);
    if (post) onSelect(post);
  };

  const mobileMoreIcon = () => (
    <span>
      <BookmarkIcon className="size-4.5 text-brand-500 sm:size-5.5" />
    </span>
  );

  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3"
      data-color-scheme={theme}
    >
      <div className="custom-calendar relative" data-color-scheme={theme}>
        <FullCalendar
          className="gap-0!"
          plugins={[themePlugin, dayGridPlugin]}
          initialView="dayGridMonth"
          locale={language === "pt-BR" ? ptBrLocale : "en"}
          headerToolbar={{ start: "prev,next today", center: "title", end: "" }}
          headerToolbarClass="sticky top-0! z-20! bg-white dark:bg-gray-900 flex-wrap! flex-row! items-center justify-between gap-3 sm:gap-4 [padding-inline:16px]! sm:[padding-inline:24px]! pt-4 sm:pt-6 pb-3 sm:pb-4"
          toolbarTitleClass="text-base! sm:text-lg! font-semibold! text-gray-800 dark:text-white/90 first-letter:uppercase"
          buttonGroupClass="gap-2"
          buttons={{
            prev: {
              iconContent: () => (
                <ChevronLeftIcon className="size-5 bg-transparent text-gray-700 sm:size-6 rtl:rotate-180 dark:text-gray-400" />
              ),
              className: NAV_BUTTON,
            },
            next: {
              iconContent: () => (
                <ChevronRightIcon className="size-5 bg-transparent text-gray-700 sm:size-6 rtl:rotate-180 dark:text-gray-400" />
              ),
              className: NAV_BUTTON,
            },
            today: {
              text: t("today"),
              className:
                "rounded-lg! border! border-gray-200! bg-transparent! px-3! sm:px-4! py-2! text-xs! sm:text-sm! font-medium! text-gray-700! hover:bg-gray-50! focus:shadow-none! disabled:opacity-50 dark:border-gray-800! dark:text-gray-400! dark:hover:bg-gray-900!",
            },
          }}
          views={{
            dayGridMonth: {
              dayMaxEvents: isMobile ? 0 : 2,
              dayHeaderAlign: (data: { inPopover: boolean }) =>
                data.inPopover ? "start" : "center",
              dayHeaderClass: (data: DayHeaderInfo) =>
                data.inPopover
                  ? "relative! border-b! border-gray-200! bg-gray-50/70! px-4! py-3! text-start! dark:border-gray-800! dark:bg-gray-800/50!"
                  : "border-x-0! border-t border-gray-200! bg-gray-50 dark:border-gray-800! dark:bg-gray-900",
              dayHeaderInnerClass: (data: DayHeaderInfo) =>
                data.inPopover
                  ? "text-sm! font-semibold! text-gray-800! dark:text-white/90!"
                  : "px-1! py-2! sm:px-3! sm:py-3! md:px-5! md:py-4! text-xs! sm:text-sm! font-medium! text-gray-400 uppercase",
              dayCellClass: (data: DayCellInfo) => {
                if (data.inPopover) return "bg-transparent! p-3!";
                return `bg-transparent! p-1! sm:p-2! ${
                  data.isToday ? "bg-gray-100! dark:bg-gray-800/40!" : ""
                }`;
              },
              dayCellTopInnerClass:
                "text-xs! sm:text-sm! text-gray-700 dark:text-gray-300",
              dayCellInnerClass: (data: DayCellInfo) => {
                if (data.inPopover)
                  return "flex custom-scrollbar max-h-60 flex-col gap-1.5 overflow-y-auto";
                if (isMobile) return "h-0 max-h-0 overflow-hidden invisible";
                return data.isToday ? "rounded-sm!" : "";
              },
              rowMoreLinkClass: isMobile
                ? "absolute! -top-1! -start-0.5! z-10! border-0! bg-transparent! p-0!"
                : "",
              rowMoreLinkInnerClass: isMobile ? "overflow-visible!" : "",
              moreLinkClass:
                "border-0! bg-transparent! p-0! hover:bg-transparent! focus:outline-none",
              moreLinkContent(args: MoreLinkInfo) {
                if (isMobile) return mobileMoreIcon();
                return (
                  <span className="inline-flex items-center rounded-sm bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-600 transition-colors hover:bg-brand-100 sm:px-1.5 sm:text-xs dark:bg-brand-500/15 dark:text-brand-400 dark:hover:bg-brand-500/25">
                    {t("more", { count: args.num })}
                  </span>
                );
              },
            },
          }}
          height="auto"
          borderless={true}
          viewClass="border-t! border-b-0! border-x-0! border-gray-200! bg-transparent! dark:border-gray-800! dark:bg-transparent!"
          tableHeaderClass="border-0! bg-gray-50! dark:bg-gray-900!"
          dayHeaderDividerClass="border-b! border-t-0! border-x-0! border-gray-200! p-0! bg-transparent! dark:border-gray-800!"
          eventClass="focus:shadow-none cursor-pointer"
          nowIndicator={false}
          tableHeaderSticky={true}
          tableClass="overflow-hidden bg-transparent!"
          rowEventClass="bg-transparent! border-0! px-1! py-0.5! shadow-none! hover:shadow-none! focus:outline-none"
          rowEventInnerClass="p-0! border-0! bg-transparent!"
          popoverFormat={{ month: "short", day: "numeric", year: "numeric" }}
          popoverClass="z-99999! w-72 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border! border-gray-200! bg-white! shadow-theme-lg dark:border-gray-800! dark:bg-gray-900!"
          popoverCloseClass="absolute end-3 top-2.5 flex size-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
          popoverCloseContent={() => <CloseIcon className="size-4" />}
          // pt-BR: 18:00 · en: 6:00 PM
          eventTimeFormat={
            language === "pt-BR"
              ? { hour: "2-digit", minute: "2-digit", hour12: false }
              : { hour: "numeric", minute: "2-digit", meridiem: "short" }
          }
          // "block" avoids the round dot FullCalendar puts on timed events
          eventDisplay="block"
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          eventContent={(eventInfo: EventDisplayInfo) => (
            <CalendarEventItem eventInfo={eventInfo} />
          )}
        />
      </div>
    </div>
  );
}
