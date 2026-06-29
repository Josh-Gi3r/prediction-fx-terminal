import { cn } from "@/lib/cn";

type Tone = "neutral" | "green" | "blue" | "gold" | "red";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--color-bg-2)] text-[var(--color-fg-1)] ring-[var(--color-line-1)]",
  green:
    "bg-[oklch(0.78_0.18_152/0.12)] text-[var(--color-accent-green)] ring-[oklch(0.78_0.18_152/0.3)]",
  blue: "bg-[oklch(0.72_0.16_235/0.12)] text-[var(--color-accent-blue)] ring-[oklch(0.72_0.16_235/0.3)]",
  gold: "bg-[oklch(0.84_0.15_85/0.12)] text-[var(--color-accent-gold)] ring-[oklch(0.84_0.15_85/0.3)]",
  red: "bg-[oklch(0.70_0.20_25/0.12)] text-[var(--color-accent-red)] ring-[oklch(0.70_0.20_25/0.3)]",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
        "text-xs font-medium ring-1 ring-inset",
        "tabular tracking-tight",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
