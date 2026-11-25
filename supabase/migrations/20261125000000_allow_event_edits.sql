-- Keep event identity and authorship intact when editing through the client.
REVOKE UPDATE ON public.events FROM authenticated;
GRANT UPDATE (calendar_id, title, description, event_date, event_time, event_type)
ON public.events TO authenticated;

CREATE POLICY "Members can update events"
ON public.events FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.calendar_members
    WHERE calendar_id = events.calendar_id AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.calendar_members
    WHERE calendar_id = events.calendar_id AND user_id = auth.uid()
  )
);
