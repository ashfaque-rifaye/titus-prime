import { motion } from "motion/react";
import type { SkillTemplate } from "@/lib/skill-templates";

export function ProvenanceBadge({
  skill,
  onClick,
  label,
}: {
  skill: SkillTemplate;
  onClick?: () => void;
  label?: string;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] mono text-muted-foreground hover:border-primary/40 hover:text-foreground transition"
      title="Click to open Workshop with the generating Python"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
      <span>provenance:</span>
      <span className="text-foreground group-hover:accent-text">
        {skill.agent}/{skill.name}.py
      </span>
      {label && <span className="opacity-60">· {label}</span>}
    </motion.button>
  );
}
