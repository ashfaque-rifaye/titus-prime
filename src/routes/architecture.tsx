import { createFileRoute, Link } from "@tanstack/react-router";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture · Titus-Prime" },
      { name: "description", content: "The LangGraph + MCP + Codex architecture that powers Titus-Prime." },
    ],
  }),
  component: ArchitecturePage,
});

function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">How Titus-Prime is built.</h1>
        <p className="mt-3 text-muted-foreground">
          A LangGraph orchestrator routes events between five specialist agents and a shared coding agent, Codex
          Prime. Every external action goes through an MCP server, every output is policy-checked, and every skill is
          committed to a versioned library.
        </p>
      </div>
      <div className="mt-10">
        <ArchitectureDiagram />
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Block title="Stateful by design">LangGraph holds the conversation state — agents, like board members, remember the meeting.</Block>
        <Block title="Sandboxed execution">Every Python skill runs in an E2B sandbox — no production system gets touched without an approved skill.</Block>
        <Block title="Provenance everywhere">Every number, alert, and email carries the file path of the skill that produced it.</Block>
      </div>
      <div className="mt-12 text-center">
        <Link to="/app" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition">
          Open the Boardroom →
        </Link>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}