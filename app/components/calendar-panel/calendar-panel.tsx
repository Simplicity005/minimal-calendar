"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday, setMonth, setYear, getYear, subDays, addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type { Room, CalendarEvent } from "../../types/calendar";
import styles from "./calendar-panel.module.css";
import { usePresence } from "../../hooks/usePresence";

type Props = {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date) => void;
  eventDates?: string[];
  onAddEvent: () => void;
  activeRoom: Room | null;
  rooms: Room[];
  refreshTrigger?: number;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const EVENT_PRIORITY = { exam: 0, quiz: 1, study: 2, general: 3 };
type EventKind = keyof typeof EVENT_PRIORITY;

function getEventKind(type: string): EventKind {
  switch (type.trim().toLowerCase()) {
    case "exam":
      return "exam";
    case "quiz":
      return "quiz";
    case "study":
    case "study session":
      return "study";
    default:
      return "general";
  }
}

function getEventLabel(type: string) {
  const label = type.trim() || "General";
  const text = label === label.toUpperCase() ? label.toLowerCase() : label;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ITEM_HEIGHT = 36; // px — height of each year row in the drum wheel
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 21 }, (_, i) => THIS_YEAR - 10 + i);

/** Monday-first weekday index (Mon = 0 … Sun = 6) */
const mondayIndex = (d: Date) => (getDay(d) + 6) % 7;

type Cell = { type: "overflow" | "day"; key: string; date: Date };

function buildCells(month: Date): Cell[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const lead = mondayIndex(start);
  const days = eachDayOfInterval({ start, end });
  const total = Math.ceil((lead + days.length) / 7) * 7;
  const trail = total - lead - days.length;

  const cells: Cell[] = [];
  for (let i = lead; i > 0; i--) {
    const d = subDays(start, i);
    cells.push({ type: "overflow", key: `prev-${format(d, "yyyy-MM-dd")}`, date: d });
  }
  days.forEach((d) => cells.push({ type: "day", key: format(d, "yyyy-MM-dd"), date: d }));
  for (let i = 1; i <= trail; i++) {
    const d = addDays(end, i);
    cells.push({ type: "overflow", key: `next-${format(d, "yyyy-MM-dd")}`, date: d });
  }
  return cells;
}

export function CalendarPanel({ selectedDate, onSelectDate, onAddEvent, activeRoom, rooms, refreshTrigger }: Props) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate || new Date()));
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const monthMenu = usePresence(monthPickerOpen);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const yearScrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dir, setDir] = useState<'next' | 'prev'>('next');

  // Scroll wheel to the correct year whenever it opens
  useEffect(() => {
    if (!yearPickerOpen || !yearScrollRef.current) return;
    const idx = YEARS.indexOf(getYear(currentMonth));
    if (idx !== -1) {
      yearScrollRef.current.scrollTop = idx * ITEM_HEIGHT;
    }
  }, [yearPickerOpen, currentMonth]);

  // Live-update year as the wheel scrolls — debounced
  const handleYearScroll = useCallback(() => {
    if (!yearScrollRef.current) return;
    const scrollTop = yearScrollRef.current.scrollTop;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const idx = Math.round(scrollTop / ITEM_HEIGHT);
      const year = YEARS[Math.max(0, Math.min(idx, YEARS.length - 1))];
      if (year !== undefined) {
        setCurrentMonth(prev => {
          if (getYear(prev) === year) return prev;
          return startOfMonth(setYear(prev, year));
        });
      }
    }, 80);
  }, []);

  const scrollToYear = (idx: number) => {
    yearScrollRef.current?.scrollTo({ top: idx * ITEM_HEIGHT, behavior: "smooth" });
  };

  // Close the month picker when clicking outside
  useEffect(() => {
    if (!monthPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setMonthPickerOpen(false);
        setYearPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [monthPickerOpen]);

  const handleSelectMonth = (monthIndex: number) => {
    setDir(monthIndex >= currentMonth.getMonth() ? 'next' : 'prev');
    setCurrentMonth(startOfMonth(setMonth(currentMonth, monthIndex)));
    setMonthPickerOpen(false);
  };

  // Fetch events for the current month
  const fetchMonthEvents = useCallback(async () => {
    if (rooms.length === 0) { setMonthEvents([]); return; }

    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    let query = supabase.from("events").select("*").gte("event_date", start).lte("event_date", end);
    if (activeRoom && activeRoom.name !== "Personal Calendar") {
      query = query.eq("calendar_id", activeRoom.id);
    } else {
      query = query.in("calendar_id", rooms.map((r) => r.id));
    }

    const { data, error } = await query;
    if (error) console.error("Error fetching month events:", error);
    else setMonthEvents((data ?? []) as CalendarEvent[]);
  }, [currentMonth, activeRoom, rooms]);

  useEffect(() => {
    fetchMonthEvents();
  }, [fetchMonthEvents, refreshTrigger]);

  const gridCells = useMemo(() => buildCells(currentMonth), [currentMonth]);
  const rowCount = gridCells.length / 7;
  const eventsByDate = useMemo(() => {
    const days = new Map<string, { event: CalendarEvent; kind: EventKind }[]>();

    for (const event of monthEvents) {
      const markers = days.get(event.event_date) ?? [];
      markers.push({ event, kind: getEventKind(event.event_type) });
      days.set(event.event_date, markers);
    }

    for (const markers of days.values()) {
      markers.sort((a, b) =>
        EVENT_PRIORITY[a.kind] - EVENT_PRIORITY[b.kind] ||
        a.event.event_time.localeCompare(b.event.event_time) ||
        a.event.id.localeCompare(b.event.id)
      );
    }

    return days;
  }, [monthEvents]);

  // Rows whose Sunday belongs to this month → continuous vertical capsule
  const sundayRange = useMemo(() => {
    const rows: number[] = [];
    gridCells.forEach((c, i) => {
      if (i % 7 === 6 && c.type === "day") rows.push(Math.floor(i / 7));
    });
    if (rows.length === 0) return null;
    return { first: rows[0], last: rows[rows.length - 1] };
  }, [gridCells]);

  const handlePrevMonth = () => { setDir('prev'); setCurrentMonth(subMonths(currentMonth, 1)); };
  const handleNextMonth = () => { setDir('next'); setCurrentMonth(addMonths(currentMonth, 1)); };

  const yearStr = format(currentMonth, "yyyy");

  return (
    <div className={styles.calendarSection}>
      <div className={styles.poster}>
        <div className={styles.posterLeft}>
          <div className={styles.monthPickerWrapper} ref={monthPickerRef}>
            <h2>
              <button
                type="button"
                className={`${styles.monthHeading} ${monthPickerOpen ? styles.monthHeadingOpen : ""}`}
                onClick={() => setMonthPickerOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={monthPickerOpen}
                aria-label={`${format(currentMonth, "MMMM yyyy")} — choose month`}
              >
                {format(currentMonth, "MMM")}
              </button>
            </h2>
            {monthMenu.mounted && (
              <div className={styles.monthDropdown} role="dialog" aria-label="Select month and year" data-closing={monthMenu.closing ? "true" : undefined}>
                {yearPickerOpen ? (
                  <>
                    <div className={styles.yearViewHeader}>
                      <button
                        className={styles.backBtn}
                        onClick={() => setYearPickerOpen(false)}
                        aria-label="Back to month view"
                      >
                        ‹
                      </button>
                      <span className={styles.yearViewTitle}>{getYear(currentMonth)}</span>
                      <div style={{ width: 24 }} />
                    </div>

                    <div className={styles.yearWheelOuter}>
                      <div className={styles.yearRail} aria-hidden="true" />
                      <div
                        className={styles.yearWheel}
                        ref={yearScrollRef}
                        onScroll={handleYearScroll}
                        aria-label="Year selector"
                      >
                        <div className={styles.yearSpacer} aria-hidden="true" />
                        {YEARS.map((year, idx) => (
                          <div
                            key={year}
                            className={`${styles.yearItem} ${year === getYear(currentMonth) ? styles.yearItemActive : ""}`}
                            onClick={() => scrollToYear(idx)}
                            aria-selected={year === getYear(currentMonth)}
                            role="option"
                          >
                            {year}
                          </div>
                        ))}
                        <div className={styles.yearSpacer} aria-hidden="true" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.yearHeader}>
                      <button
                        className={styles.yearBtn}
                        onClick={() => setYearPickerOpen(true)}
                        aria-label="Pick a year"
                      >
                        {getYear(currentMonth)}
                      </button>
                    </div>

                    <div className={styles.monthDivider} />

                    <div className={styles.monthGrid} role="listbox" aria-label="Select month">
                      {MONTH_NAMES.map((name, i) => (
                        <button
                          key={name}
                          role="option"
                          aria-selected={i === currentMonth.getMonth()}
                          className={`${styles.monthOption} ${i === currentMonth.getMonth() ? styles.monthOptionActive : ""}`}
                          onClick={() => handleSelectMonth(i)}
                        >
                          {name.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={styles.indexBadge} aria-hidden="true">
            {format(currentMonth, "MM")}
          </div>

          <span className={styles.year} aria-hidden="true">{yearStr}</span>
        </div>

        <div className={styles.navRow}>
          <button type="button" className={styles.navArrow} onClick={handlePrevMonth} aria-label="Previous month">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className={styles.navArrow} onClick={handleNextMonth} aria-label="Next month">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className={styles.addBtn} onClick={onAddEvent}>+ Add event</button>
        </div>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>

      <div
        className={`${styles.grid} ${dir === "next" ? styles.slideNext : styles.slidePrev}`}
        key={currentMonth.toString()}
        style={{ ["--rows" as string]: rowCount }}
      >
        {sundayRange && (
          <div
            className={styles.sundayPill}
            aria-hidden="true"
            style={{
              top: `calc(${(sundayRange.first / rowCount) * 100}% + 4px)`,
              height: `calc(${((sundayRange.last - sundayRange.first + 1) / rowCount) * 100}% - 8px)`,
            }}
          />
        )}

        {gridCells.map((cell) => {
          if (cell.type === "overflow") {
            return (
              <div key={cell.key} className={`${styles.cell} ${styles.overflow}`}>
                <span className={styles.date}>{format(cell.date, "d")}</span>
              </div>
            );
          }

          const dayEvents = eventsByDate.get(cell.key) ?? [];
          const featured = dayEvents[0];
          const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
          const isTodayDate = isToday(cell.date);

          return (
            <div
              key={cell.key}
              className={`${styles.cell} ${styles.dayCell} ${isSelected ? styles.selected : ""} ${isTodayDate ? styles.today : ""}`}
              onClick={() => onSelectDate(cell.date)}
              title={dayEvents.map(({ event }) => event.title).join(" · ") || undefined}
            >
              <span className={styles.date}>{format(cell.date, "d")}</span>

              {featured && (
                <>
                  <div className={styles.eventDots} aria-hidden="true">
                    {dayEvents.map(({ event, kind }, index) => (
                      <span
                        key={event.id}
                        className={index === 0 ? `${styles.dot} ${styles.featuredDot}` : styles.dot}
                        data-event-kind={kind}
                      />
                    ))}
                  </div>
                  <span className={styles.eventPill} data-event-kind={featured.kind}>
                    {getEventLabel(featured.event.event_type)}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.legend}>
        <span><span className={styles.dot} data-event-kind="exam" />Exam</span>
        <span><span className={styles.dot} data-event-kind="quiz" />Quiz</span>
        <span><span className={styles.dot} data-event-kind="study" />Study session</span>
      </div>
    </div>
  );
}
