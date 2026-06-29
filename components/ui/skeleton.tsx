import { cn } from "@/lib/cn";

/**
 * Shimmer loading skeleton. Use for any pending fetch state.
 *
 * Example:
 *   {isLoading ? <Skeleton className="h-10 w-32" /> : <Price value={p} />}
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-[var(--color-bg-2)]",
        "before:absolute before:inset-0",
        "before:bg-[linear-gradient(90deg,transparent_0%,oklch(1_0_0/0.06)_50%,transparent_100%)]",
        "before:bg-[length:200%_100%] before:animate-[shimmer_1.6s_linear_infinite]",
        className,
      )}
      {...props}
    />
  );
}
