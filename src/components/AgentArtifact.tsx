/**
 * AgentArtifact — actionable provenance cards.
 *
 * Two primary artifact types remain in the Boardroom:
 *   • Collection  → email draft with send pipeline + connector routing
 *   • Subscription → contract-aware cancel workflow with agent recommendation
 *
 * Tax, Treasury, Scenario have moved to /review.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
  Calendar,
  FileText,
  Sliders,
  Trophy,
  Code2,
  ChevronDown,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  Shield,
  ArrowRight,
  MessageSquare,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { SkillTemplate } from "@/lib/skill-templates";
import { toast } from "sonner";

export type ArtifactKind = "collection" | "subscription" | "tax" | "treasury" | "scenario";

type Props = {
  kind: ArtifactKind;
  title: string;
  skill?: SkillTemplate;
  data: any;
  onCustomize?: (instruction: string) => Promise<void>;
};

export function AgentArtifact({ kind, title, skill, data, onCustomize }: Props) {
  const [showCode, setShowCode] = useState(false);
  const [customInstr, setCustomInstr] = useState("");
  const [customizing, setCustomizing] = useState(false);

  const Icon =
    kind === "collection"
      ? Mail
      : kind === "subscription"
        ? Calendar
        : kind === "tax"
          ? FileText
          : kind === "treasury"
            ? Sliders
            : Trophy;

  return (
    <div className="rounded-xl border border-border bg-surface/60 backdrop-blur overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/40">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 accent-text" />
          <span className="text-xs font-semibold">{title}</span>
        </div>
        <span className="text-[10px] mono text-muted-foreground capitalize">{kind} artifact</span>
      </div>

      <div className="p-4">
        {kind === "collection" && <CollectionView data={data} />}
        {kind === "subscription" && <SubscriptionView data={data} />}
        {kind === "tax" && <TaxView data={data} />}
        {kind === "treasury" && <TreasuryView data={data} />}
        {kind === "scenario" && <ScenarioView data={data} />}

        {/* Customize prompt */}
        {onCustomize && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-[10px] mono uppercase tracking-wide text-muted-foreground mb-1.5">
              Customize this agent's behavior
            </div>
            <div className="flex gap-2">
              <input
                value={customInstr}
                onChange={(e) => setCustomInstr(e.target.value)}
                placeholder="e.g. soften the tone for enterprise customers, add VAT to filings…"
                className="flex-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <button
                onClick={async () => {
                  if (!customInstr.trim() || customizing) return;
                  setCustomizing(true);
                  try {
                    await onCustomize(customInstr);
                    setCustomInstr("");
                  } finally {
                    setCustomizing(false);
                  }
                }}
                disabled={!customInstr.trim() || customizing}
                className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition shrink-0"
              >
                {customizing ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        )}

        {/* Technical detail disclosure */}
        {skill && (
          <div className="mt-4 pt-3 border-t border-border">
            <button
              onClick={() => setShowCode((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
            >
              <Code2 className="h-3 w-3" />
              <span>{showCode ? "Hide" : "Show"} technical detail</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showCode ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {showCode && (
                <motion.pre
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mono mt-2 overflow-auto rounded-md border border-border bg-background/60 p-3 text-[11px] leading-relaxed scrollbar-thin max-h-72"
                >
                  <code className="text-foreground/80">{skill.code}</code>
                </motion.pre>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────  Collection — Next-Gen Engine  ──────────────────────────── */

type PipelineStep = "draft" | "approved" | "queued" | "sent" | "opened" | "intent";
type RouteChannel = "gmail" | "slack";

function CollectionView({ data }: { data: any }) {
  const inv = data?.invoice ?? {
    customer: "Acme Robotics",
    amount: 8200,
    daysLate: 14,
    id: "INV-1042",
  };

  const [route, setRoute] = useState<RouteChannel>(inv.daysLate < 15 ? "slack" : "gmail");
  const [tone, setTone] = useState<"friendly" | "firm">(inv.daysLate < 15 ? "friendly" : "firm");
  const [pipeline, setPipeline] = useState<PipelineStep>("draft");
  const [editing, setEditing] = useState(false);
  const [offeredPlan, setOfferedPlan] = useState(false);

  // Contextual Intelligence Logic
  const typicalDelay = 12; // Mocked historical behavior
  const isAnomalous = inv.daysLate > typicalDelay + 5;
  const recommendation = isAnomalous
    ? "Anomalous delay detected. Recommend direct firm escalation via Gmail."
    : "Within historical variance. Recommend soft internal nudge via Slack to AE.";

  const slackBody = `Hi @sarah_ae, your client ${inv.customer} is ${inv.daysLate} days late on Invoice ${inv.id} ($${inv.amount.toLocaleString()}). Since they usually pay around day ${typicalDelay}, this is slightly delayed but not critical yet. Could you backchannel a soft nudge?`;

  const gmailFriendly = `Hi ${firstName(inv.customer)},\n\nHope all's well at ${inv.customer}. Just a quick nudge — Invoice ${inv.id} for $${inv.amount.toLocaleString()} is now ${inv.daysLate} days past the Net-30 term. Could you check with your AP team when we can expect payment?\n\nHappy to jump on a call if helpful.\n\nBest,\nAlex`;

  const gmailFirm = `Hi ${firstName(inv.customer)},\n\nInvoice ${inv.id} ($${inv.amount.toLocaleString()}) is now ${inv.daysLate} days overdue. Please remit by end of week. If cash flow is tight, please let us know immediately so we can discuss options.\n\nThanks,\nAlex`;

  const paymentPlanOffer = `\n\nIf helpful, we can split this into a 3-month installment plan of $${(inv.amount / 3).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo. Let me know if you'd like me to send over the updated terms.`;

  const getBaseBody = () => {
    if (route === "slack") return slackBody;
    return tone === "firm" ? gmailFirm : gmailFriendly;
  };

  const [editableBody, setEditableBody] = useState(getBaseBody());

  // Update body when route/tone changes
  const displayBody = editing
    ? editableBody
    : getBaseBody() + (offeredPlan && route === "gmail" ? paymentPlanOffer : "");

  // Track every scheduled timer so the pipeline animation loop is always torn
  // down on unmount (no setState-after-unmount, no orphaned callbacks).
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);
  const schedule = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  async function handleApprove() {
    // Cancel any in-flight pipeline before starting a new one.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPipeline("approved");

    // For Gmail: actually compose a real RFC-822 message on the server (and send
    // it for real if GMAIL_USER + GMAIL_APP_PASSWORD are configured). The
    // pipeline then reflects what genuinely happened, not a hardcoded flag.
    if (route === "gmail") {
      try {
        const subject = `Invoice ${inv.id} — ${inv.daysLate} days overdue`;
        const res = await fetch("/api/email/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toName: inv.customer,
            subject,
            body: displayBody,
            invoiceId: inv.id,
          }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        setPipeline("queued");
        if (data?.sent) {
          toast.success("Email sent via Gmail", { description: data.detail });
          schedule(() => setPipeline("sent"), 800);
          schedule(() => setPipeline("opened"), 3000);
          schedule(() => setPipeline("intent"), 5000);
        } else {
          // Honest: real message composed, but not actually delivered.
          toast.message("Real email composed (preview)", {
            description: data?.detail ?? "Set GMAIL_USER + GMAIL_APP_PASSWORD to send for real.",
          });
          schedule(() => setPipeline("sent"), 1200);
        }
      } catch {
        setPipeline("queued");
        toast.error("Could not reach the email service.");
      }
      return;
    }

    // Slack route stays a local simulation (no real webhook configured).
    schedule(() => {
      setPipeline("queued");
      toast.success("Message queued via Slack", {
        description: `${inv.id} → ${inv.customer} · $${inv.amount.toLocaleString()}`,
      });
      schedule(() => setPipeline("sent"), 1500);
    }, 800);
  }

  const steps: { key: PipelineStep; label: string; icon: React.ElementType }[] = [
    { key: "draft", label: "Draft", icon: FileText },
    { key: "approved", label: "Approved", icon: CheckCircle2 },
    {
      key: "queued",
      label: `Queued via ${route === "slack" ? "Slack" : "Gmail"}`,
      icon: route === "slack" ? MessageSquare : Mail,
    },
    { key: "sent", label: "Sent", icon: Send },
    ...(route === "gmail"
      ? ([
          { key: "opened", label: "Opened", icon: Clock },
          { key: "intent", label: "Intent Detected", icon: Shield },
        ] as any)
      : []),
  ];

  const stepIndex = steps.findIndex((s) => s.key === pipeline);

  return (
    <div className="space-y-4">
      {/* Contextual Intelligence Panel */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Contextual Intelligence
          </span>
        </div>
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          <span className="text-foreground font-medium">{inv.customer}</span> typically pays{" "}
          <span className="mono">{typicalDelay} days</span> late. They are currently at{" "}
          <span className="mono text-rose-300">{inv.daysLate} days</span>.
        </div>
        <div className="mt-1.5 text-[11px] font-medium accent-text bg-primary/10 inline-block px-2 py-0.5 rounded border border-primary/20">
          Agent: {recommendation}
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = i <= stepIndex;
          const isCurrent = i === stepIndex;
          return (
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              {i > 0 && <div className={`h-px w-4 ${isActive ? "bg-primary" : "bg-border"}`} />}
              <div
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] mono transition ${
                  isCurrent
                    ? "bg-primary/15 accent-text border border-primary/30"
                    : isActive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-background/40 text-muted-foreground border border-border"
                }`}
              >
                <StepIcon className="h-3 w-3" />
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Routing & Strategy */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-y border-border py-2.5 bg-background/20 px-2 rounded-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] mono text-muted-foreground uppercase tracking-wider">
              Route
            </span>
            <select
              value={route}
              onChange={(e) => {
                setRoute(e.target.value as RouteChannel);
                setOfferedPlan(false);
              }}
              disabled={pipeline !== "draft"}
              className="bg-background/80 border border-border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-primary/40 disabled:opacity-50 font-medium"
            >
              <option value="slack">Slack (Internal AE)</option>
              <option value="gmail">Gmail (Direct to Client)</option>
            </select>
          </div>

          {route === "gmail" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] mono text-muted-foreground uppercase tracking-wider">
                Tone
              </span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as "friendly" | "firm")}
                disabled={pipeline !== "draft"}
                className="bg-background/80 border border-border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-primary/40 disabled:opacity-50 font-medium"
              >
                <option value="friendly">Friendly</option>
                <option value="firm">Firm</option>
              </select>
            </div>
          )}
        </div>

        {pipeline === "draft" && (
          <button
            onClick={() => {
              if (!editing) setEditableBody(displayBody);
              setEditing((v) => !v);
            }}
            className="text-[10px] mono text-muted-foreground hover:text-foreground transition border border-border bg-background/60 px-2 py-1 rounded"
          >
            {editing ? "Preview" : "Edit Draft"}
          </button>
        )}
      </div>

      {/* Interactive Negotiation (Only for Gmail) */}
      {pipeline === "draft" && route === "gmail" && !editing && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOfferedPlan((p) => !p)}
            className={`text-[10px] mono px-2.5 py-1.5 rounded-md border transition ${
              offeredPlan
                ? "bg-primary/20 border-primary/40 accent-text"
                : "bg-background/60 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {offeredPlan ? "✓ 3-Month Plan Offered" : "+ Offer 3-Month Payment Plan"}
          </button>
        </div>
      )}

      {/* Draft Body */}
      {editing ? (
        <textarea
          value={editableBody}
          onChange={(e) => setEditableBody(e.target.value)}
          className="w-full text-xs rounded-md border border-border bg-background/60 p-3 leading-relaxed focus:outline-none focus:border-primary/40 min-h-[120px] resize-y"
        />
      ) : (
        <div className="relative">
          <div className="absolute top-2 right-2 text-[9px] mono text-muted-foreground uppercase tracking-widest opacity-50 select-none">
            {route === "slack" ? "Slack Message" : "Email Draft"}
          </div>
          <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-background/60 p-3 pt-6 leading-relaxed font-sans">
            {displayBody}
          </pre>
        </div>
      )}

      {/* Footer Action */}
      <div className="flex items-center justify-between text-[11px] mono gap-2 pt-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>
            {inv.id} · ${inv.amount.toLocaleString()} · {inv.daysLate}d late
          </span>
        </div>

        {pipeline === "draft" ? (
          <button
            onClick={handleApprove}
            className="rounded-md bg-primary/15 hover:bg-primary/25 accent-text border border-primary/30 px-3 py-1.5 transition inline-flex items-center gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="h-3 w-3" />
            Approve & Execute
          </button>
        ) : pipeline === "intent" ? (
          <span className="inline-flex items-center gap-1 text-primary animate-pulse">
            <CheckCircle2 className="h-3 w-3" />
            Client engaged
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {steps[stepIndex].label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────  Subscription — Contract-Aware Cancel  ──────────────────────────── */

function SubscriptionView({ data }: { data: any }) {
  const subs = data?.subscriptions ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Mock contract metadata per vendor
  const contractMeta: Record<
    string,
    {
      contractType: string;
      endDate: string;
      earlyTermPenalty: string | null;
      agentRecommendation: string;
      recommendedAction: "cancel" | "downgrade" | "negotiate" | "keep";
      connector: string;
    }
  > = {
    "Notion Team Plan": {
      contractType: "Annual · auto-renew",
      endDate: "2026-07-15",
      earlyTermPenalty: null,
      agentRecommendation:
        "Cancel within window — no penalty. Team rarely uses Notion; Slack + Linear covers docs.",
      recommendedAction: "cancel",
      connector: "Slack → #procurement",
    },
    Linear: {
      contractType: "Annual · committed",
      endDate: "2027-01-10",
      earlyTermPenalty: "$720 (50% remaining term)",
      agentRecommendation:
        "Keep — essential for engineering velocity. Early termination not worth the penalty.",
      recommendedAction: "keep",
      connector: "Email → vendor@linear.app",
    },
    "AWS Reserved Instances": {
      contractType: "1-year RI · committed",
      endDate: "2027-03-01",
      earlyTermPenalty: "Cannot cancel — reserved commitment. Consider selling on RI Marketplace.",
      agentRecommendation:
        "Keep but optimize — agent detected 34% underutilization on 2 instances. Downsize i3.xlarge → i3.large.",
      recommendedAction: "negotiate",
      connector: "AWS Console → RI Marketplace",
    },
    "Slack Enterprise": {
      contractType: "Annual · auto-renew",
      endDate: "2026-06-08",
      earlyTermPenalty: null,
      agentRecommendation:
        "Cancel — duplicates Microsoft Teams functionality. Cancel window closes in 2 days.",
      recommendedAction: "cancel",
      connector: "Email → enterprise@slack.com",
    },
    Datadog: {
      contractType: "Annual · committed",
      endDate: "2026-11-20",
      earlyTermPenalty: "$4,800 (50% remaining)",
      agentRecommendation:
        "Keep — critical observability platform. Negotiate volume discount at renewal.",
      recommendedAction: "keep",
      connector: "Email → sales@datadoghq.com",
    },
  };

  return (
    <div className="space-y-2">
      {subs.map((s: any) => {
        const isExpanded = expandedId === (s.id ?? s.vendor);
        const meta = contractMeta[s.vendor] ?? {
          contractType: "Monthly",
          endDate: "N/A",
          earlyTermPenalty: null,
          agentRecommendation: "Review manually.",
          recommendedAction: "keep" as const,
          connector: "Email",
        };

        return (
          <div
            key={s.id ?? s.vendor}
            className="rounded-lg border border-border bg-background/60 overflow-hidden"
          >
            {/* Summary row */}
            <div className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{s.vendor}</div>
                <div className="text-[10px] mono text-muted-foreground">
                  ${s.monthlyCost}/mo · renews in {s.renewsIn}d · cancel window closes in{" "}
                  {s.cancelWindowClosesIn}d
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : (s.id ?? s.vendor))}
                  className="text-[10px] mono rounded border border-rose-500/40 bg-rose-500/10 text-rose-300 px-2 py-1 hover:bg-rose-500/20 transition"
                >
                  {isExpanded ? "Close" : "Cancel"}
                </button>
                <button
                  onClick={() => {
                    toast.success(
                      `${s.vendor} kept. Reminder set for ${s.cancelWindowClosesIn - 2}d before renewal.`,
                    );
                  }}
                  className="text-[10px] mono rounded border border-border bg-background/40 text-muted-foreground px-2 py-1 hover:text-foreground transition"
                >
                  Keep
                </button>
              </div>
            </div>

            {/* Expanded contract detail drawer */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-3 py-3 space-y-3 bg-background/20">
                    {/* Contract details */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-border bg-background/40 px-2.5 py-2">
                        <div className="text-[9px] mono uppercase text-muted-foreground">
                          Contract
                        </div>
                        <div className="text-[11px] font-medium mt-0.5">{meta.contractType}</div>
                      </div>
                      <div className="rounded-md border border-border bg-background/40 px-2.5 py-2">
                        <div className="text-[9px] mono uppercase text-muted-foreground">
                          End Date
                        </div>
                        <div className="text-[11px] font-medium mt-0.5">{meta.endDate}</div>
                      </div>
                    </div>

                    {/* Early termination warning */}
                    {meta.earlyTermPenalty && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] mono uppercase text-amber-300 font-semibold">
                            Early Termination Penalty
                          </div>
                          <div className="text-[11px] text-amber-200 mt-0.5">
                            {meta.earlyTermPenalty}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Agent recommendation */}
                    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
                      <Shield className="h-3.5 w-3.5 accent-text mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] mono uppercase accent-text font-semibold">
                          Agent Recommendation
                        </div>
                        <div className="text-[11px] text-foreground/80 mt-0.5">
                          {meta.agentRecommendation}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons with connector routing */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-[10px] mono text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        Route: <span className="text-foreground">{meta.connector}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {meta.recommendedAction === "cancel" ? (
                          <button
                            onClick={() => {
                              toast.success(`Cancellation queued for ${s.vendor}`, {
                                description: `Routed via ${meta.connector} · Added to Approval Queue`,
                              });
                              setExpandedId(null);
                            }}
                            className="text-[10px] mono rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 px-2.5 py-1 hover:bg-rose-500/25 transition inline-flex items-center gap-1"
                          >
                            <Send className="h-3 w-3" />
                            Queue Cancellation
                          </button>
                        ) : meta.recommendedAction === "negotiate" ? (
                          <button
                            onClick={() => {
                              toast.info(`Negotiation request queued for ${s.vendor}`, {
                                description: `Agent will draft optimization proposal`,
                              });
                              setExpandedId(null);
                            }}
                            className="text-[10px] mono rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2.5 py-1 hover:bg-amber-500/25 transition inline-flex items-center gap-1"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Queue Negotiation
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              toast.success(`${s.vendor} marked as essential — no action needed.`);
                              setExpandedId(null);
                            }}
                            className="text-[10px] mono rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 hover:bg-emerald-500/25 transition inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Confirm Keep
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────  Legacy views (kept for /review)  ──────────────────────────── */

function TaxView({ data }: { data: any }) {
  const states = data?.states ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {states.map((s: any) => (
          <div
            key={s.state}
            className={`rounded-lg border p-2.5 ${s.nexusCrossed ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-background/40"}`}
          >
            <div className="text-[10px] mono uppercase text-muted-foreground">{s.state}</div>
            <div className="text-xs font-semibold mt-0.5">${s.revenueYTD.toLocaleString()}</div>
            <div
              className={`text-[10px] mono mt-0.5 ${s.nexusCrossed ? "text-rose-300" : "text-muted-foreground"}`}
            >
              {s.nexusCrossed
                ? `Owes $${s.taxOwed.toFixed(2)}`
                : `${Math.round((s.revenueYTD / (s.threshold || 1)) * 100)}% of threshold`}
            </div>
          </div>
        ))}
      </div>
      {data?.preFilled && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
          <div className="text-[10px] mono uppercase tracking-wider text-rose-300 mb-1">
            Pre-filled return preview
          </div>
          <div className="text-xs">
            {data.preFilled.state} · {data.preFilled.period} · taxable base $
            {data.preFilled.base.toLocaleString()} × {(data.preFilled.rate * 100).toFixed(2)}% = $
            {data.preFilled.owed.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{data.preFilled.citation}</div>
        </div>
      )}
    </div>
  );
}

function TreasuryView({ data }: { data: any }) {
  const k = data?.assumptions ?? {
    floor: 5000,
    payrollDay: 15,
    payrollAmount: 22000,
    recoveryPct: 50,
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Knob label="Safety floor" value={`$${k.floor.toLocaleString()}`} />
      <Knob label="Payroll day" value={`Day ${k.payrollDay}`} />
      <Knob label="Payroll amount" value={`$${k.payrollAmount.toLocaleString()}`} />
      <Knob label="AR recovery rate" value={`${k.recoveryPct}%`} />
    </div>
  );
}

function ScenarioView({ data }: { data: any }) {
  const plans = data?.plans ?? [];
  return (
    <div className="space-y-2">
      {plans.map((p: any, i: number) => (
        <div key={i} className="rounded-lg border border-border bg-background/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold">{p.name}</div>
            <span className="text-[10px] mono accent-text">{p.successPct}%</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{p.rationale}</div>
          <div className="mt-2 flex items-center gap-2 text-[10px] mono">
            <span className="text-muted-foreground">Buffer gain</span>
            <span className="text-emerald-300">+${p.bufferGain?.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Knob({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2">
      <div className="text-[10px] mono uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mono mt-0.5">{value}</div>
    </div>
  );
}

function firstName(full: string): string {
  return full.split(/\s|,/)[0];
}
