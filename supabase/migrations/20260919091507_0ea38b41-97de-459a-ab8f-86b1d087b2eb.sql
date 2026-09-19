CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX participants_event_nickname_key
  ON public.participants (event_id, lower(nickname));
CREATE INDEX participants_event_id_idx ON public.participants (event_id);

GRANT SELECT ON public.participants TO anon;
GRANT SELECT ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read participants" ON public.participants
  FOR SELECT USING (true);

ALTER TABLE public.responses ADD COLUMN points integer NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN current_question_started_at timestamptz;