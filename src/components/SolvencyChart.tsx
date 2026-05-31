/**
 * SolvencyChart — the Treasury Sentinel hero.
 *
 * Two modes:
 *   • STANDBY    — what happens if you take no action (red line, deficit)
 *   • AUTOPILOT  — what happens if you approve the recommended scenario (green line)
 *
 * The area between the two lines is shaded as "agent value" — the money the
 * autonomous system saves by acting. A glide cursor with a vertical guide
 * surfaces per-day microanalysis on hover.
 */
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, ShieldCheck, TrendingUp, Info } from "lucide-react";

export type ProjectionPoint = { day: number; balance: number; event?: string };

type Props = {
  standby: ProjectionPoint[];
  autopilot: ProjectionPoint[];
  /** Critical floor for the danger band (e.g. SVB minimum) */
  safetyFloor?: number;
  mode: "standby" | "autopilot";
  onModeChange: (mode: "standby" | "autopilot") => void;
};

const W = 720;
const H = 240;
const PAD_LEFT = 56;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 36;
const INNER_W = W - PAD_LEFT - PAD_RIGHT;
const INNER_H = H - PAD_TOP - PAD_BOTTOM;

export function SolvencyChart({
  standby,
  autopilot,
  safetyFloor = 5_000,
  mode,
  onModeChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const series = mode === "autopilot" ? autopilot : standby;
  const days = series.length;

  const { yMin, yMax } = useMemo(() => {
    const all = [...standby.map((p) => p.balance), ...autopilot.map((p) => p.balance)];
    const min = Math.min(...all, 0);
    const max = Math.max(...all);
    const headroom = (max - min) * 0.15;
    return { yMin: min - headroom, yMax: max + headroom };
  }, [standby, autopilot]);

  const x = (d: number) => PAD_LEFT + (d / Math.max(1, days - 1)) * INNER_W;
  const y = (v: number) => PAD_TOP + INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H;

  const buildPath = (pts: ProjectionPoint[]) =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(" ");

  const buildArea = (pts: ProjectionPoint[]) => {
    const top = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(" ");
    return `${top} L${x(pts[pts.length - 1].day).toFixed(1)},${y(yMin).toFixed(1)} L${x(pts[0].day).toFixed(1)},${y(yMin).toFixed(1)} Z`;
  };

  const buildBetween = () => {
    const top = autopilot
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(" ");
    const bot = [...standby]
      .reverse()
      .map((p) => `L${x(p.day).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(" ");
    return `${top} ${bot} Z`;
  };

  const standbyEnd = standby[standby.length - 1]?.balance ?? 0;
  const autopilotEnd = autopilot[autopilot.length - 1]?.balance ?? 0;
  const agentValue = autopilotEnd - standbyEnd;

  const lowest = useMemo(
    () => series.reduce((m, p) => (p.balance < m.balance ? p : m), series[0]),
    [series],
  );
  const lowestStandby = useMemo(
    () => standby.reduce((m, p) => (p.balance < m.balance ? p : m), standby[0]),
    [standby],
  );

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const day = Math.round(((px - PAD_LEFT) / INNER_W) * (days - 1));
    if (day >= 0 && day < days) setHoverDay(day);
    else setHoverDay(null);
  };

  const hovered = hoverDay !== null ? series[hoverDay] : null;
  const hoveredStandby = hoverDay !== null ? standby[hoverDay] : null;
  const hoveredAuto = hoverDay !== null ? autopilot[hoverDay] : null;

  const trend =
    mode === "autopilot"
      ? autopilotEnd >= safetyFloor
        ? `Surplus +$${autopilotEnd.toLocaleString()}`
        : `Tight: $${autopilotEnd.toLocaleString()}`
      : standbyEnd < safetyFloor
        ? `Deficit projected ($${standbyEnd.toLocaleString()})`
        : `Stable $${standbyEnd.toLocaleString()}`;

  const trendTone = mode === "autopilot" ? "emerald" : standbyEnd < safetyFloor ? "rose" : "indigo";

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5 backdrop-blur relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-primary opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <h3 className="text-sm font-semibold tracking-wide uppercase">
              30-Day Solvency Forecast & Net Runway
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground max-w-md">
            Compare what happens when you let it ride versus when Titus-Prime acts on the
            recommended scenario.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-background/40 p-1 rounded-xl border border-border">
          <button
            onClick={() => onModeChange("standby")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-tight transition-all ${
              mode === "standby"
                ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ⚠ Standby (Do nothing)
          </button>
          <button
            onClick={() => onModeChange("autopilot")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-tight transition-all ${
              mode === "autopilot"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🚀 Autopilot (Take action)
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[240px] cursor-crosshair"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverDay(null)}
        >
          <defs>
            <linearGradient id="standbyArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="autopilotArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="agentValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Y grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = yMin + (yMax - yMin) * (1 - f);
            const yy = PAD_TOP + INNER_H * f;
            return (
              <g key={f}>
                <line
                  x1={PAD_LEFT}
                  x2={W - PAD_RIGHT}
                  y1={yy}
                  y2={yy}
                  stroke="hsl(var(--border))"
                  strokeOpacity="0.5"
                  strokeDasharray="2 4"
                />
                <text
                  x={PAD_LEFT - 8}
                  y={yy + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="hsl(var(--muted-foreground))"
                  className="mono"
                >
                  ${Math.round(v / 1000)}k
                </text>
              </g>
            );
          })}

          {/* Safety floor */}
          <line
            x1={PAD_LEFT}
            x2={W - PAD_RIGHT}
            y1={y(safetyFloor)}
            y2={y(safetyFloor)}
            stroke="#f43f5e"
            strokeOpacity="0.5"
            strokeDasharray="3 3"
          />
          <text
            x={PAD_LEFT + 4}
            y={y(safetyFloor) - 4}
            fontSize="9"
            fill="#f43f5e"
            className="mono"
          >
            Safety floor ${safetyFloor.toLocaleString()}
          </text>

          {/* Agent value shaded area (between standby and autopilot) */}
          {mode === "autopilot" && <path d={buildBetween()} fill="url(#agentValue)" />}

          {/* Inactive line (dimmed) */}
          {mode === "autopilot" ? (
            <motion.path
              key="standby-dim"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6 }}
              d={buildPath(standby)}
              fill="none"
              stroke="#f87171"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeOpacity="0.5"
            />
          ) : (
            <motion.path
              key="autopilot-dim"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6 }}
              d={buildPath(autopilot)}
              fill="none"
              stroke="#34d399"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeOpacity="0.45"
            />
          )}

          {/* Active line filled */}
          <path
            d={buildArea(series)}
            fill={`url(#${mode === "autopilot" ? "autopilotArea" : "standbyArea"})`}
          />
          <motion.path
            key={`${mode}-active`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7 }}
            d={buildPath(series)}
            fill="none"
            stroke={mode === "autopilot" ? "#34d399" : "#f87171"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Lowest-point marker on standby (the "where you lag") */}
          {mode === "standby" && (
            <g>
              <motion.circle
                initial={{ r: 0 }}
                animate={{ r: 6 }}
                transition={{ delay: 0.7, type: "spring" }}
                cx={x(lowestStandby.day)}
                cy={y(lowestStandby.balance)}
                fill="#f87171"
                stroke="#0b0b0d"
                strokeWidth="2"
              />
              <text
                x={x(lowestStandby.day)}
                y={y(lowestStandby.balance) - 12}
                textAnchor="middle"
                fontSize="9.5"
                fill="#fca5a5"
                className="mono"
              >
                LAG · Day {lowestStandby.day} · ${lowestStandby.balance.toLocaleString()}
              </text>
            </g>
          )}

          {/* Improvement marker on autopilot (the "where you gain") */}
          {mode === "autopilot" && (
            <g>
              {(() => {
                const peakDelta = autopilot.reduce(
                  (m, p, i) => {
                    const delta = p.balance - standby[i].balance;
                    return delta > m.delta ? { idx: i, delta } : m;
                  },
                  { idx: 0, delta: 0 },
                );
                const ap = autopilot[peakDelta.idx];
                return (
                  <>
                    <motion.circle
                      initial={{ r: 0 }}
                      animate={{ r: 6 }}
                      transition={{ delay: 0.7, type: "spring" }}
                      cx={x(ap.day)}
                      cy={y(ap.balance)}
                      fill="#34d399"
                      stroke="#0b0b0d"
                      strokeWidth="2"
                    />
                    <text
                      x={x(ap.day)}
                      y={y(ap.balance) - 12}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="#86efac"
                      className="mono"
                    >
                      GAIN · +${peakDelta.delta.toLocaleString()} on Day {ap.day}
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Hover guide */}
          {hoverDay !== null && (
            <g>
              <line
                x1={x(hoverDay)}
                x2={x(hoverDay)}
                y1={PAD_TOP}
                y2={PAD_TOP + INNER_H}
                stroke="hsl(var(--primary))"
                strokeOpacity="0.6"
                strokeDasharray="2 2"
              />
              {hoveredStandby && (
                <circle
                  cx={x(hoverDay)}
                  cy={y(hoveredStandby.balance)}
                  r="4"
                  fill="#f87171"
                  stroke="#0b0b0d"
                  strokeWidth="2"
                />
              )}
              {hoveredAuto && (
                <circle
                  cx={x(hoverDay)}
                  cy={y(hoveredAuto.balance)}
                  r="4"
                  fill="#34d399"
                  stroke="#0b0b0d"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {/* X axis labels */}
          {[0, 6, 12, 18, 24, 30]
            .filter((d) => d < days)
            .map((d) => (
              <text
                key={d}
                x={x(d)}
                y={H - 14}
                textAnchor="middle"
                fontSize="9"
                fill="hsl(var(--muted-foreground))"
                className="mono"
              >
                Day {d}
              </text>
            ))}
        </svg>

        {/* Trend chip */}
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <span className="text-[10px] mono text-muted-foreground">Post-solver trend</span>
          <span
            className={`text-[10px] mono px-2 py-0.5 rounded border ${
              trendTone === "emerald"
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : trendTone === "rose"
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
            }`}
          >
            {trend}
          </span>
        </div>
      </div>

      {/* Microanalysis card */}
      <div className="mt-3 rounded-xl border border-border bg-background/40 p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] mono uppercase text-muted-foreground tracking-wider">
              {hovered ? `Day ${hovered.day}` : "Glide cursor over the chart for microanalysis"}
            </div>
            <div className="text-xs text-foreground truncate">
              {hovered
                ? (hovered.event ?? "Idle day · no scheduled events")
                : "Hover any point to inspect inflows / outflows."}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 shrink-0"
            >
              <Reading label="Standby" value={hoveredStandby?.balance ?? 0} tone="rose" />
              <Reading label="Autopilot" value={hoveredAuto?.balance ?? 0} tone="emerald" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Headline KPI strip */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Kpi
          icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}
          label="Standby end-of-month"
          value={`$${standbyEnd.toLocaleString()}`}
          tone="rose"
        />
        <Kpi
          icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
          label="Autopilot end-of-month"
          value={`$${autopilotEnd.toLocaleString()}`}
          tone="emerald"
        />
        <Kpi
          icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
          label="Agent value (Δ)"
          value={`+$${agentValue.toLocaleString()}`}
          tone="primary"
        />
      </div>
    </div>
  );
}

function Reading({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "rose" | "emerald";
}) {
  const color = tone === "rose" ? "text-rose-300" : "text-emerald-300";
  return (
    <div className="text-right">
      <div className="text-[9px] mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm mono font-semibold ${color}`}>
        ${Math.round(value).toLocaleString()}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "rose" | "emerald" | "primary";
}) {
  const border =
    tone === "emerald"
      ? "border-emerald-500/30"
      : tone === "rose"
        ? "border-rose-500/30"
        : "border-primary/30";
  const valueColor =
    tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-foreground";
  return (
    <div className={`rounded-lg border ${border} bg-background/40 px-3 py-2`}>
      <div className="flex items-center gap-1.5 text-[10px] mono uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-0.5 text-sm font-semibold mono ${valueColor}`}>{value}</div>
    </div>
  );
}
