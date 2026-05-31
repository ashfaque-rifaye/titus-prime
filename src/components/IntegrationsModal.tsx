import { motion, AnimatePresence } from "motion/react";
import {
  X,
  CheckCircle2,
  Loader2,
  Plus,
  CreditCard,
  Building,
  BarChart3,
  Cloud,
  MessageSquare,
  Headphones,
  Mail,
  Server,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const INTEGRATIONS = [
  { id: "stripe", name: "Stripe", category: "Revenue", icon: CreditCard },
  { id: "plaid", name: "Plaid", category: "Banking", icon: Building },
  { id: "quickbooks", name: "QuickBooks", category: "Accounting", icon: BarChart3 },
  { id: "salesforce", name: "Salesforce", category: "CRM", icon: Cloud },
  { id: "slack", name: "Slack", category: "Communication", icon: MessageSquare },
  { id: "zendesk", name: "Zendesk", category: "Support", icon: Headphones },
  { id: "gmail", name: "Gmail", category: "Email", icon: Mail },
  { id: "aws", name: "AWS Billing", category: "Infrastructure", icon: Server },
  { id: "gcp", name: "Google Cloud Billing", category: "Infrastructure", icon: Cloud },
];

export function IntegrationsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);

  if (!isOpen) return null;

  async function handleConnect(id: string, name: string) {
    if (connected.includes(id) || connecting === id) return;

    setConnecting(id);

    // Simulate OAuth flow / connection delay
    await new Promise((r) => setTimeout(r, 1500));

    setConnecting(null);
    setConnected((prev) => [...prev, id]);
    toast.success(`Successfully connected ${name}`);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/70 backdrop-blur grid place-items-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl border border-border bg-surface/95 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-background/40">
            <div>
              <h2 className="text-lg font-semibold">Integrate Applications</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect external sources to empower the Boardroom agents.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:text-foreground text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto scrollbar-thin">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTEGRATIONS.map((app) => {
                const isConnecting = connecting === app.id;
                const isConnected = connected.includes(app.id);
                const AppIcon = app.icon;

                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3 hover:border-primary/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-surface border border-border">
                        <AppIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{app.name}</div>
                        <div className="text-[10px] mono text-muted-foreground uppercase">
                          {app.category}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConnect(app.id, app.name)}
                      disabled={isConnecting || isConnected}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        isConnected
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                      }`}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Connecting…</span>
                        </>
                      ) : isConnected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Connected</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>Connect</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border bg-background/40 px-5 py-4 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground mono">
              Agents automatically sync data from connected apps every 60 minutes.
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
