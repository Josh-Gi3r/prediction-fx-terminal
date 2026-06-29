"use client";

import { cn } from "@/lib/cn";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef } from "react";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md",
      "border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-2.5 py-1.5",
      "text-xs text-[var(--color-fg-0)] shadow-[var(--shadow-card)]",
      "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
      "data-[state=delayed-open]:fade-in-0 data-[state=closed]:fade-out-0",
      "data-[state=delayed-open]:zoom-in-95 data-[state=closed]:zoom-out-95",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = "TooltipContent";
