-- Agent customizations: free-form user instructions that shape how each
-- specialist agent behaves. The orchestrator reads the latest row per agent
-- before composing prompts.

CREATE TABLE IF NOT EXISTS public.agent_customizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  instruction text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_customizations_agent
  ON public.agent_customizations (agent, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_customizations TO anon, authenticated;
GRANT ALL ON public.agent_customizations TO service_role;

ALTER TABLE public.agent_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_agent_customizations_all"
  ON public.agent_customizations FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
