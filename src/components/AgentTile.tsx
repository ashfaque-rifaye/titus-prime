import { motion } from "motion/react";
import type { ReactNode } from "react";

export function AgentTile({
  icon,
  name,
  status,
  children,
  tone = "default",
}: {
  icon: string;
  name: string;
  status?: string;
  children: ReactNode;
  tone?: "default" | "alert" | "success";
}) {
  const ring =
    tone === "alert"
      ? "border-rose-400/40"
      : tone === "success"
        ? "border-emerald-400/40"
        : "border-border";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border ${ring} bg-surface/60 p-4 backdrop-blur`}
    >
      <div className="flex items-start gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-background/60 text-base shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{name}</div>
          {status && (
            <div className="text-[11px] text-muted-foreground mono truncate">{status}</div>
          )}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </motion.div>
  );
}
