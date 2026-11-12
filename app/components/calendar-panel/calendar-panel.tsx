"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday, setMonth, setYear, getYear, subDays, addDays } from "date-fns";
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
  const monthMenu = usePresence(monthPickerOpen, 180);
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

  // Rows whose Sunday belongs to this month → continuous vertical capsule
  const sundayRange = useMemo(() => {
    const rows: number[] = [];
    gridCells.forEach((c, i) => {
      if (i % 7 === 6 && c.type === "day") rows.push(Math.floor(i / 7));
    });
    if (rows.length === 0) return null;
    return { first: rows[0], last: rows[rows.length - 1] };
  }, [gridCells]);

  const nextMonth = addMonths(currentMonth, 1);
  const miniCells = useMemo(() => buildCells(nextMonth), [nextMonth]);

  const handlePrevMonth = () => { setDir('prev'); setCurrentMonth(subMonths(currentMonth, 1)); };
  const handleNextMonth = () => { setDir('next'); setCurrentMonth(addMonths(currentMonth, 1)); };

  const getDotClass = (type: string) => {
    const t = type.toLowerCase();
    if (t === "exam") return styles.dotExam;
    if (t === "quiz") return styles.dotQuiz;
    if (t === "study") return styles.dotStudy;
    return styles.dotGeneral;
  };

  const yearStr = format(currentMonth, "yyyy");

  return (
    <div className={styles.calendarSection}>
      <div className={styles.poster}>
        <div className={styles.posterLeft}>
          <div className={styles.monthPickerWrapper} ref={monthPickerRef}>
            <h2
              className={`${styles.monthHeading} ${monthPickerOpen ? styles.monthHeadingOpen : ""}`}
              onClick={() => setMonthPickerOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={monthPickerOpen}
              aria-label={`${format(currentMonth, "MMMM yyyy")} — choose month`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setMonthPickerOpen((o) => !o)}
            >
              {format(currentMonth, "MMM")}
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

          <div className={styles.yearStack} aria-hidden="true">
            <span>{yearStr.slice(0, 2)}</span>
            <span>{yearStr.slice(2)}</span>
          </div>
        </div>

        <div className={styles.posterRight}>
          <div className={styles.miniCal} aria-hidden="true">
            <div className={styles.miniIndex}>{format(nextMonth, "MM")}</div>
            <div className={styles.miniGrid}>
              {WEEKDAYS.map((w) => (
                <span key={w} className={styles.miniWeekday}>{w}</span>
              ))}
              {miniCells.map((c) => (
                <span
                  key={c.key}
                  className={`${styles.miniDay} ${c.type === "overflow" ? styles.miniDayHidden : ""}`}
                >
                  {c.type === "day" ? format(c.date, "d") : ""}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.navRow}>
            <button className={styles.navArrow} onClick={handlePrevMonth} aria-label="Previous month">
              <svg width="28" height="10" viewBox="0 0 28 10" fill="none" aria-hidden="true">
                <path d="M27 5H1M1 5l4-4M1 5l4 4" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button className={styles.navArrow} onClick={handleNextMonth} aria-label="Next month">
              <svg width="28" height="10" viewBox="0 0 28 10" fill="none" aria-hidden="true">
                <path d="M1 5h26M27 5l-4-4M27 5l-4 4" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button className={styles.addBtn} onClick={onAddEvent}>+ Add event</button>
          </div>
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

        {gridCells.map((cell, idx) => {
          if (cell.type === "overflow") {
            return (
              <div key={cell.key} className={`${styles.cell} ${styles.overflow}`} style={{ ["--i" as string]: idx }}>
                <span className={styles.date}>{format(cell.date, "d")}</span>
              </div>
            );
          }

          const dateStr = format(cell.date, "yyyy-MM-dd");
          const dayEvents = monthEvents.filter(e => e.event_date === dateStr);
          const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
          const isTodayDate = isToday(cell.date);

          return (
            <div
              key={cell.key}
              className={`${styles.cell} ${styles.dayCell} ${isSelected ? styles.selected : ""} ${isTodayDate ? styles.today : ""}`}
              style={{ ["--i" as string]: idx }}
              onClick={() => onSelectDate(cell.date)}
              title={dayEvents.map(e => e.title).join(" · ") || undefined}
            >
              <span className={styles.date}>{format(cell.date, "d")}</span>

              {dayEvents.length > 0 && (
                <div className={styles.eventDots}>
                  {dayEvents.slice(0, 3).map(ev => (
                    <span
                      key={ev.id}
                      className={`${styles.dot} ${getDotClass(ev.event_type)}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.legend}>
        <span><span className={`${styles.dot} ${styles.dotExam}`}></span>Exam</span>
        <span><span className={`${styles.dot} ${styles.dotQuiz}`}></span>Quiz</span>
        <span><span className={`${styles.dot} ${styles.dotStudy}`}></span>Study session</span>
      </div>
    </div>
  );
}
