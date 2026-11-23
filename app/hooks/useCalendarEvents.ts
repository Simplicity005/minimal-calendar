"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CalendarEvent, Room } from "../types/calendar";

const EMPTY_EVENTS: CalendarEvent[] = [];

export function useCalendarEvents(
  activeRoom: Room | null,
  rooms: Room[],
  from: string | undefined,
  to: string | undefined,
  refreshTrigger = 0,
) {
  const query = useMemo(() => {
    if (!activeRoom || !from || !to) return null;
    const roomIds = activeRoom.name === "Personal Calendar"
      ? rooms.map((room) => room.id)
      : [activeRoom.id];
    return roomIds.length ? { roomIds, from, to } : null;
  }, [activeRoom, rooms, from, to]);

  const [result, setResult] = useState<{ query: NonNullable<typeof query>; events: CalendarEvent[] }>();
  const current = result?.query === query ? result : undefined;

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();

    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("calendar_id", query.roomIds)
        .gte("event_date", query.from)
        .lte("event_date", query.to)
        .order("event_date")
        .order("event_time")
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;

      if (error) {
        console.error("Error fetching calendar events:", error);
        setResult((previous) => previous?.query === query ? previous : { query, events: EMPTY_EVENTS });
      } else {
        setResult({ query, events: (data ?? []) as CalendarEvent[] });
      }
    };

    void fetchEvents();
    return () => controller.abort();
  }, [query, refreshTrigger]);

  return { events: current?.events ?? EMPTY_EVENTS, isLoading: Boolean(query && !current) };
}
