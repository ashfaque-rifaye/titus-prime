export function Sparkline({
  points,
  width = 240,
  height = 60,
  threshold = 5000,
}: {
  points: { day: number; balance: number }[];
  width?: number;
  height?: number;
  threshold?: number;
}) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.day);
  const ys = points.map((p) => p.balance);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys);
  const sx = (x: number) => ((x - minX) / Math.max(1, maxX - minX)) * width;
  const sy = (y: number) => height - ((y - minY) / Math.max(1, maxY - minY)) * height;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.day).toFixed(1)} ${sy(p.balance).toFixed(1)}`).join(" ");
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  const thY = sy(threshold);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <line x1={0} x2={width} y1={thY} y2={thY} stroke="oklch(0.65 0.22 25)" strokeDasharray="4 4" strokeWidth={1} opacity={0.6} />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.5} />
      {points.map((p, i) =>
        p.balance < threshold ? <circle key={i} cx={sx(p.day)} cy={sy(p.balance)} r={2} fill="oklch(0.65 0.22 25)" /> : null,
      )}
    </svg>
  );
}