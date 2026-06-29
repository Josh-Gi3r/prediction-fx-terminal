import { cn } from "@/lib/cn";

interface ProgressRingProps {
  /** 0..1 progress fraction. */
  progress: number;
  /** Outer diameter in px. */
  size?: number;
  /** Stroke width in px. */
  stroke?: number;
  tone?: "neutral" | "green" | "blue" | "gold" | "red";
  className?: string;
  /** Optional centered label, e.g. "23d". */
  label?: React.ReactNode;
}

const toneStrokes = {
  neutral: "stroke-[var(--color-fg-2)]",
  green: "stroke-[var(--color-accent-green)]",
  blue: "stroke-[var(--color-accent-blue)]",
  gold: "stroke-[var(--color-accent-gold)]",
  red: "stroke-[var(--color-accent-red)]",
} as const;

/**
 * Circular progress ring. Used for countdowns (e.g. WC kickoff) and
 * loading indicators where a flat bar would feel out of place.
 */
export function ProgressRing({
  progress,
  size = 48,
  stroke = 3,
  tone = "blue",
  className,
  label,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * clamped;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`Progress ${Math.round(clamped * 100)}%`}
      >
        <title>{`Progress ${Math.round(clamped * 100)}%`}</title>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-[var(--color-line-1)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={cn("transition-[stroke-dasharray] duration-700 ease-out", toneStrokes[tone])}
        />
      </svg>
      {label !== undefined && (
        <span className="absolute inset-0 grid place-items-center text-[10px] font-medium tabular-nums text-[var(--color-fg-0)]">
          {label}
        </span>
      )}
    </div>
  );
}
