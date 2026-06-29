import { cn } from "@/lib/cn";

interface SparklineProps {
  /** Numeric series. Required, can be 2+ points. */
  data: readonly number[];
  /** Deterministic seed if you want to generate placeholder data; ignored when `data.length > 0`. */
  seed?: number;
  width?: number;
  height?: number;
  /** Stroke tone; defaults to neutral. */
  tone?: "neutral" | "green" | "red" | "blue" | "gold";
  /** When true, draws the area under the line with a soft gradient. */
  filled?: boolean;
  className?: string;
}

const toneStrokes = {
  neutral: "stroke-[var(--color-fg-2)]",
  green: "stroke-[var(--color-accent-green)]",
  red: "stroke-[var(--color-accent-red)]",
  blue: "stroke-[var(--color-accent-blue)]",
  gold: "stroke-[var(--color-accent-gold)]",
} as const;

const toneFills = {
  neutral: "oklch(0.58 0.010 250 / 0.18)",
  green: "oklch(0.78 0.18 152 / 0.22)",
  red: "oklch(0.70 0.20 25 / 0.22)",
  blue: "oklch(0.72 0.16 235 / 0.22)",
  gold: "oklch(0.84 0.15 85 / 0.22)",
} as const;

/**
 * Deterministic PRNG so identical seeds always produce identical sparklines —
 * critical for SSR/CSR hydration parity.
 */
function seededSeries(seed: number, length = 32): number[] {
  const out: number[] = [];
  let s = seed * 9301 + 49297;
  let prev = 0.5;
  for (let i = 0; i < length; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    prev = prev * 0.7 + r * 0.3;
    out.push(prev);
  }
  return out;
}

export function Sparkline({
  data,
  seed = 1,
  width = 80,
  height = 24,
  tone = "neutral",
  filled = false,
  className,
}: SparklineProps) {
  const series = data.length > 0 ? data : seededSeries(seed);
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = series.length > 1 ? width / (series.length - 1) : width;

  const pts = series.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return [x, y] as const;
  });

  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = filled ? `${line} L${width.toFixed(2)},${height} L0,${height} Z` : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      role="img"
      aria-label="Price trend"
    >
      <title>Price trend</title>
      {area && <path d={area} fill={toneFills[tone]} />}
      <path
        d={line}
        fill="none"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={toneStrokes[tone]}
      />
    </svg>
  );
}
