"use client";

import { useUiStore } from "@/stores/ui";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

/**
 * Side-anchored drawer used for trade entry. Slides in from the right on
 * desktop, from the bottom on mobile. Sits over a blurred overlay.
 */
export function DrawerFrame({ children }: { children: React.ReactNode }) {
  const open = useUiStore((s) => s.drawer.open);
  const close = useUiStore((s) => s.closeDrawer);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? null : close())}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 50,
                  background: "rgba(10,14,26,0.55)",
                  backdropFilter: "blur(4px)",
                }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={{ opacity: 0, x: 64 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 64 }}
                transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
                className="ds4"
                style={{
                  position: "fixed",
                  right: 0,
                  top: 0,
                  zIndex: 50,
                  display: "flex",
                  height: "100%",
                  width: "100%",
                  maxWidth: 440,
                  flexDirection: "column",
                  background: "#fff",
                  borderLeft: "1px solid var(--line)",
                  boxShadow: "0 0 0 0 transparent, -20px 0 60px rgba(10,20,55,.12)",
                }}
              >
                <DialogPrimitive.Title className="sr-only">Trade entry</DialogPrimitive.Title>
                <DialogPrimitive.Close
                  aria-label="Close drawer"
                  style={{
                    position: "absolute",
                    right: 14,
                    top: 14,
                    zIndex: 10,
                    borderRadius: "50%",
                    padding: 6,
                    color: "var(--muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "background .15s, color .15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={16} />
                </DialogPrimitive.Close>
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
