import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Approval = {
  id: string;
  agent: string;
  title: string;
  body: string | null;
  status: string;
  created_at: string;
};

export function ApprovalQueue() {
  const [items, setItems] = useState<Approval[]>([]);

  async function refresh() {
    const { data } = await supabase
      .from("approvals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Approval[]);
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("approvals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    await supabase
      .from("approvals")
      .update({ status: decision, decided_at: new Date().toISOString() })
      .eq("id", id);
    toast.success(decision === "approved" ? "Approved" : "Skipped");
    refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Approval Queue</h3>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] mono accent-text">
          {items.length} pending
        </span>
      </div>
      <div className="space-y-2 min-h-[80px]">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">
              Inside the envelope. Nothing needs you right now.
            </div>
          ) : (
            items.map((a) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="rounded-md border border-border bg-background/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mono">{a.agent}</div>
                    <div className="text-sm font-medium">{a.title}</div>
                    {a.body && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {a.body}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => decide(a.id, "approved")}
                      className="rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(a.id, "rejected")}
                      className="rounded border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export async function queueApproval(input: {
  agent: string;
  title: string;
  body?: string;
  payload?: unknown;
}) {
  await supabase.from("approvals").insert({
    agent: input.agent,
    title: input.title,
    body: input.body,
    payload: (input.payload ?? null) as any,
    status: "pending",
  });
}
