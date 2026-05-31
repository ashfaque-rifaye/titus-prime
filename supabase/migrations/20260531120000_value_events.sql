-- Value ledger: every quantifiable thing an agent does is recorded here so the
-- Boardroom can show a running "money found" scoreboard and prove outcomes.

CREATE TABLE IF NOT EXISTS public.value_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  -- protected = cash crunch avoided · recovered = AR collected ·
  -- saved = spend cut (cancel/pause/discount) · time = hours of manual work avoided
  category text NOT NULL,
  amount_usd numeric NOT NULL DEFAULT 0,
  minutes_saved integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  run_id text,
  -- projected = expected impact at action time · realized = confirmed later
  status text NOT NULL DEFAULT 'projected',
  ref text, -- optional pointer (invoice id, vendor, plan name)
  created_at timestamptz NOT NULL DEFAULT now(),
  realized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_value_events_created ON public.value_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_events_ref ON public.value_events (ref);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.value_events TO anon, authenticated;
GRANT ALL ON public.value_events TO service_role;

ALTER TABLE public.value_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_value_events_all"
  ON public.value_events FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
