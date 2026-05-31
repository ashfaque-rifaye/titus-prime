import { motion } from "motion/react";
import { Sliders, Mail, Calendar, FileText, Trophy } from "lucide-react";

const agents = [
  { label: "Treasury", icon: <Sliders className="h-6 w-6 mx-auto" /> },
  { label: "Collection", icon: <Mail className="h-6 w-6 mx-auto" /> },
  { label: "Subscription", icon: <Calendar className="h-6 w-6 mx-auto" /> },
  { label: "Tax", icon: <FileText className="h-6 w-6 mx-auto" /> },
  { label: "Scenario", icon: <Trophy className="h-6 w-6 mx-auto" /> },
];
const mcps = ["Filesystem", "Git", "SQLite", "E2B", "Stripe", "Plaid", "Gmail", "Web Fetch"];

function Layer({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-surface"} p-4`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${accent ? "bg-primary" : "bg-muted-foreground"}`}
        />
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-center text-sm">
      {children}
    </div>
  );
}
function Arrow() {
  return (
    <div className="my-2 flex justify-center">
      <div className="h-5 w-px bg-gradient-to-b from-transparent via-primary/60 to-transparent" />
    </div>
  );
}

export function ArchitectureDiagram() {
  return (
    <div className="relative rounded-2xl border border-border bg-surface/60 p-6 ambient-glow">
      <Layer title="Titus-Prime UI">
        <div className="grid grid-cols-2 gap-3">
          <Pill>Boardroom</Pill>
          <Pill>Workshop</Pill>
        </div>
      </Layer>
      <Arrow />
      <Layer title="Orchestrator · LangGraph state machine">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Routes events</span>
          <span>·</span>
          <span>Enforces Policy Envelope</span>
          <span>·</span>
          <span>Manages approval queue</span>
        </div>
      </Layer>
      <Arrow />
      <Layer title="Specialist Agents">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {agents.map((a) => (
            <motion.div
              key={a.label}
              whileHover={{ y: -2 }}
              className="rounded-md border border-border bg-background/60 p-3 text-center"
            >
              <div className="text-muted-foreground mb-1">{a.icon}</div>
              <div className="mt-1 text-xs font-medium">{a.label}</div>
            </motion.div>
          ))}
        </div>
      </Layer>
      <Arrow />
      <Layer title="Codex Prime · shared coding agent" accent>
        <div className="text-xs text-muted-foreground">
          Inspects data · Writes Python · Runs in E2B sandbox · Versions skills in git
        </div>
      </Layer>
      <Arrow />
      <Layer title="MCP Server Layer">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {mcps.map((m) => (
            <div
              key={m}
              className="mono text-[11px] rounded border border-border bg-background/60 px-2 py-1.5 text-center text-muted-foreground"
            >
              {m} MCP
            </div>
          ))}
        </div>
      </Layer>
    </div>
  );
}
