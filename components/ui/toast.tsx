"use client";

import { cn } from "@/lib/cn";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  ttlMs: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "ttlMs"> & { ttlMs?: number }) => string;
  dismiss: (id: string) => void;
}

const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ tone, title, description, ttlMs = 4000 }) => {
    const id = `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, tone, title, description, ttlMs }] }));
    if (ttlMs > 0) {
      setTimeout(() => get().dismiss(id), ttlMs);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Imperative API — call from anywhere (event handlers, async flows).
 *
 *   toast.success({ title: "Order placed", description: "Settles in ~1s" });
 *   toast.error({ title: "FX provider rejected the swap", description: msg });
 */
export const toast = {
  success: (args: { title: string; description?: string; ttlMs?: number }) =>
    useToasts.getState().push({ tone: "success", ...args }),
  error: (args: { title: string; description?: string; ttlMs?: number }) =>
    useToasts.getState().push({ tone: "error", ...args }),
  info: (args: { title: string; description?: string; ttlMs?: number }) =>
    useToasts.getState().push({ tone: "info", ...args }),
  dismiss: (id: string) => useToasts.getState().dismiss(id),
};

const toneIcons: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const toneRing: Record<ToastTone, string> = {
  success: "ring-[oklch(0.78_0.18_152/0.4)] text-[var(--color-accent-green)]",
  error: "ring-[oklch(0.70_0.20_25/0.4)] text-[var(--color-accent-red)]",
  info: "ring-[oklch(0.72_0.16_235/0.4)] text-[var(--color-accent-blue)]",
};

/**
 * Toaster — mount once at the root of the app (above the routed children).
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = toneIcons[t.tone];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3",
                "rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-1)]/95 backdrop-blur-md",
                "px-4 py-3 ring-1",
                toneRing[t.tone],
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--color-fg-0)]">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs text-[var(--color-fg-1)]">{t.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-full p-1 text-[var(--color-fg-2)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg-0)]"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
