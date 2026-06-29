import { cn } from "@/lib/cn";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { forwardRef } from "react";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "rounded-full font-medium",
    "transition-[transform,box-shadow,background,color] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-0)]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-fg-0)] text-[var(--color-bg-0)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_oklch(1_0_0/0.15)]",
        secondary:
          "text-[var(--color-fg-0)] ring-1 ring-inset ring-[var(--color-line-2)] hover:bg-[var(--color-bg-2)]",
        ghost:
          "text-[var(--color-fg-1)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg-0)]",
        long: "bg-[oklch(0.78_0.18_152/0.18)] text-[var(--color-accent-green)] ring-1 ring-inset ring-[oklch(0.78_0.18_152/0.35)] hover:bg-[oklch(0.78_0.18_152/0.28)]",
        short:
          "bg-[oklch(0.70_0.20_25/0.16)] text-[var(--color-accent-red)] ring-1 ring-inset ring-[oklch(0.70_0.20_25/0.35)] hover:bg-[oklch(0.70_0.20_25/0.26)]",
        yes: "bg-[oklch(0.78_0.18_152/0.14)] text-[var(--color-accent-green)] ring-1 ring-inset ring-[oklch(0.78_0.18_152/0.3)] hover:bg-[oklch(0.78_0.18_152/0.24)]",
        no: "bg-[oklch(0.70_0.20_25/0.14)] text-[var(--color-accent-red)] ring-1 ring-inset ring-[oklch(0.70_0.20_25/0.3)] hover:bg-[oklch(0.70_0.20_25/0.22)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export { buttonVariants };
