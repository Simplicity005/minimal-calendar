"use client";
import { useEffect, useRef, useState } from "react";
import type { CalendarEvent, EventFields, Room } from "../../types/calendar";
import styles from "./event-dialog.module.css";
import { usePresence } from "../../hooks/usePresence";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fields: EventFields) => Promise<void>;
  event: CalendarEvent | null;
  rooms: Room[];
  defaultRoomId: string;
  defaultDate: string;
};
export function EventDialog({ isOpen, onClose, onSave, event, rooms, defaultRoomId, defaultDate }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) formRef.current?.reset();
  }, [isOpen]);
  const { mounted, closing } = usePresence(isOpen);
  if (!mounted) return null;
  const handleSubmit = async (submit: React.FormEvent<HTMLFormElement>) => {
    submit.preventDefault();
    if (isSaving) return;
    const data = new FormData(submit.currentTarget);
    const time = String(data.get("time"));
    setIsSaving(true);
    setError("");
    try {
      await onSave({
        calendar_id: String(data.get("calendar")),
        title: String(data.get("title")),
        event_date: String(data.get("date")),
        event_time: event && time === event.event_time.slice(0, 5) ? event.event_time : time,
        event_type: String(data.get("type")),
        description: String(data.get("description")),
      });
      onClose();
    } catch (cause) {
      console.error("Error saving event:", cause);
      setError("Couldn’t save this event. Your changes are still here. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className={styles.backdrop} data-closing={closing ? "true" : undefined} role="presentation">
      <div
        className={styles.dialog} data-closing={closing ? "true" : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
      >
        <h2 id="event-dialog-title" className={styles.title}>
          {event ? "Edit Event" : "Add Event"}
        </h2>
        <form ref={formRef} onSubmit={handleSubmit} onReset={() => setError("")}>
          <fieldset disabled={isSaving} className={styles.form}>
            <label className={styles.field}>
              Title
              <input
                type="text"
                required
                name="title"
                defaultValue={event?.title ?? ""}
                autoFocus
              />
            </label>
            <label className={styles.field}>
              Description (Optional)
              <textarea
                rows={2}
                name="description"
                defaultValue={event?.description ?? ""}
                placeholder="e.g. Topics to cover..."
              />
            </label>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                Date
                <input
                  type="date"
                  required
                  name="date"
                  defaultValue={event?.event_date ?? defaultDate}
                />
              </label>
              <label className={styles.field}>
                Time
                <input
                  type="time"
                  required
                  name="time"
                  defaultValue={event?.event_time.slice(0, 5) ?? "10:00"}
                />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                Calendar
                <select
                  required
                  name="calendar"
                  defaultValue={event?.calendar_id ?? defaultRoomId}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Type
                <input
                  type="text"
                  required
                  placeholder="e.g. Lecture"
                  name="type"
                  defaultValue={event?.event_type ?? "General"}
                />
              </label>
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className={styles.saveButton}>
                {isSaving ? "Saving…" : event ? "Save Changes" : "Save Event"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
