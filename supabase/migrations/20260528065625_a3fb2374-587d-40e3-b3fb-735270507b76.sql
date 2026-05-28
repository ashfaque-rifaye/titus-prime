
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  language text NOT NULL DEFAULT 'python',
  code text NOT NULL,
  summary text,
  input_hash text,
  output_summary text,
  duration_ms integer,
  scheduled_cron text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yaml_content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO anon, authenticated;
GRANT ALL ON public.skills TO service_role;
GRANT ALL ON public.approvals TO service_role;
GRANT ALL ON public.policies TO service_role;

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_skills_all" ON public.skills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo_approvals_all" ON public.approvals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo_policies_all" ON public.policies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.policies (yaml_content) VALUES (
'# Titus-Prime Policy Envelope
auto_actions:
  - "Send collection reminders <= $1,000 to customers <= 14 days late"
  - "Pause optional subscriptions <= $300/mo when cash buffer < $10k"
  - "Pre-pay vendors when discount > 1.5% AND cash buffer > $25k"

always_escalate:
  - "Tax filings (any state, any amount)"
  - "Subscription cancellations > $5k/yr"
  - "Vendor payment delays"
  - "Collection actions > $1,000"
');
