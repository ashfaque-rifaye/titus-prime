/**
 * AskMode — a CFO-grade Q&A panel inside the Boardroom.
 *
 * Not a chat. Single question → single grounded answer, with cited figures
 * pulled from the canonical snapshot. The LLM is instructed to return strict
 * JSON; we render that JSON as a high-density answer card.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Loader2, ChevronRight } from "lucide-react";

type Answer = {
  answer: string;
  highlights: string[];
  citedFigures: Array<{ label: string; value: string }>;
  engine?: string;
};

const SAMPLE_QUESTIONS = [
  "What's our 30-day cash runway?",
  "Who's the largest overdue customer?",
  "Which subscriptions can I cancel without breaking ops?",
  "Where am I most exposed on tax?",
  "What single action saves us the most cash this month?",
];

export function AskMode() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<Answer | null>(null);

  async function run(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setAns(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!r.ok) {
        setAns({ answer: `(${r.status}) Couldn't reach Ask Mode.`, highlights: [], citedFigures: [] });
      } else {
        const j = (await r.json()) as Answer;
        setAns(j);
      }
    } catch (e: any) {
      setAns({ answer: e?.message ?? "Network error", highlights: [], citedFigures: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/5 to-surface/40 p-5 backdrop-blur relative overflow-hidden">
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 accent-text" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">Ask the CFO</h3>
        <span className="text-[10px] mono text-muted-foreground">grounded in your live snapshot</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What do you want to know about your finances?"
          className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3 w-3" />}
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>

      {/* Sample chips */}
      {!ans && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SAMPLE_QUESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQ(s);
                run(s);
              }}
              className="rounded-full border border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5 transition text-[11px] px-2.5 py-1 text-muted-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Answer card */}
      <AnimatePresence>
        {ans && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-xl border border-border bg-background/60 p-4"
          >
            <div className="text-sm leading-relaxed text-foreground">{ans.answer}</div>

            {ans.highlights && ans.highlights.length > 0 && (
              <ul className="mt-3 space-y-1">
                {ans.highlights.map((h, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex gap-2 text-xs text-muted-foreground"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    <span>{h}</span>
                  </motion.li>
                ))}
              </ul>
            )}

            {ans.citedFigures && ans.citedFigures.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 pt-3 border-t border-border">
                {ans.citedFigures.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 text-[11px]"
                  >
                    <span className="text-muted-foreground">{f.label}:</span>
                    <span className="mono text-foreground">{f.value}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-[10px] mono text-muted-foreground">
              <button
                onClick={() => {
                  setAns(null);
                  setQ("");
                }}
                className="hover:text-foreground transition"
              >
                ← ask again
              </button>
              {ans.engine && <span>via {ans.engine}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
