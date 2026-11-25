"use client";

import { useRef } from "react";
import { format } from "date-fns";
import { X, Calendar as CalendarIcon, Clock, AlignLeft, User, Pencil } from "lucide-react";
import type { CalendarEvent, Room } from "../../types/calendar";
import styles from "./event-details-dialog.module.css";
import { usePresence } from "../../hooks/usePresence";

type Props = {
  event: CalendarEvent | null;
  rooms: Room[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  currentUserId: string | null;
};

export function EventDetailsDialog({ event: eventProp, rooms, isOpen, onClose, onEdit, currentUserId }: Props) {
  // Remember the last event so the content stays visible during the exit animation
  const lastEvent = useRef<CalendarEvent | null>(eventProp);
  if (eventProp) lastEvent.current = eventProp;
  const event = eventProp ?? lastEvent.current;

  const { mounted, closing } = usePresence(isOpen && !!eventProp);
  if (!mounted || !event) return null;

  const eventRoom = rooms.find((r) => r.id === event.calendar_id);
  const roomName = eventRoom ? eventRoom.name : "Unknown Calendar";
  
  // Hide creator detail if it's the personal calendar
  const isPersonalCalendar = roomName === "Personal Calendar";
  
  const creatorLabel = event.created_by 
    ? (event.created_by === currentUserId ? "You" : `User #${event.created_by.slice(0, 8)}`) 
    : "Unknown";

  const getBadgeClass = (type: string) => {
    const t = type.toLowerCase();
    if (t === "exam") return styles.badgeExam;
    if (t === "quiz") return styles.badgeQuiz;
    if (t === "study") return styles.badgeStudy;
    return styles.badgeGeneral;
  };

  let displayDate = "";
  try {
    const [y, m, d] = event.event_date.split("-").map(Number);
    displayDate = format(new Date(y, m - 1, d), "EEEE, MMMM do, yyyy");
  } catch (e) {
    displayDate = event.event_date;
  }

  return (
    <div className={styles.backdrop} data-closing={closing ? "true" : undefined} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog} data-closing={closing ? "true" : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className={styles.header}>
          <div className={`${styles.badge} ${getBadgeClass(event.event_type)}`}>
            {event.event_type}
          </div>
          <h2 id="event-details-title" className={styles.title}>
            {event.title}
          </h2>
        </div>

        <div className={styles.body}>
          <div className={styles.detailRow}>
            <Clock className={styles.icon} size={16} />
            <div className={styles.detailText}>
              <span className={styles.label}>Time & Date</span>
              <span className={styles.value}>
                {event.event_time.slice(0, 5)} on {displayDate}
              </span>
            </div>
          </div>

          <div className={styles.detailRow}>
            <CalendarIcon className={styles.icon} size={16} />
            <div className={styles.detailText}>
              <span className={styles.label}>Calendar</span>
              <span className={styles.value}>{roomName}</span>
            </div>
          </div>

          {!isPersonalCalendar && (
            <div className={styles.detailRow}>
              <User className={styles.icon} size={16} />
              <div className={styles.detailText}>
                <span className={styles.label}>Created By</span>
                <span className={styles.value}>{creatorLabel}</span>
              </div>
            </div>
          )}

          <div className={styles.detailRow} style={{ alignItems: "flex-start" }}>
            <AlignLeft className={styles.icon} size={16} style={{ marginTop: "4px" }} />
            <div className={styles.detailText}>
              <span className={styles.label}>Description</span>
              <span className={styles.value} style={{ whiteSpace: "pre-wrap" }}>
                {event.description || <span className={styles.emptyDescription}>No description provided.</span>}
              </span>
            </div>
          </div>
        </div>
        {eventRoom && (
          <button type="button" className={styles.editBtn} onClick={() => onEdit(event)}>
            <Pencil size={14} aria-hidden="true" /> Edit event
          </button>
        )}
      </div>
    </div>
  );
}
