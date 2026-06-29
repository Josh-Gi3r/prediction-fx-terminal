"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { topTeams } from "@/lib/wc2026";
import { useUiStore } from "@/stores/ui";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  ArrowRight,
  Banknote,
  BarChart2,
  Coins,
  Layers,
  Repeat,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface CommandItem {
  id: string;
  label: string;
  hint: string;
  group: "navigate" | "trade" | "wc";
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

function useCommands(): CommandItem[] {
  return useMemo(() => {
    const nav: CommandItem[] = [
      {
        id: "go-trade",
        label: "Predict FX",
        hint: "Forwards, perps, corridor heatmap",
        group: "navigate",
        icon: TrendingUp,
        href: "/trade",
      },
      {
        id: "go-wc",
        label: "Predict WC",
        hint: "Outright + matches + bracket",
        group: "navigate",
        icon: Trophy,
        href: "/wc",
      },
      {
        id: "go-swap",
        label: "Swap FX",
        hint: "Stablecoin swaps at the best price across desks",
        group: "navigate",
        icon: Repeat,
        href: "/swap",
      },
      {
        id: "go-markets",
        label: "FX Markets",
        hint: "Live rates across every corridor and desk",
        group: "navigate",
        icon: BarChart2,
        href: "/markets",
      },
      {
        id: "go-earn",
        label: "Earn",
        hint: "Aave, Pendle, HLP, DeFiLlama yields",
        group: "navigate",
        icon: Coins,
        href: "/earn",
      },
      {
        id: "go-cash",
        label: "P2P",
        hint: "Fiat on / off-ramp · P2P",
        group: "navigate",
        icon: Banknote,
        href: "/cash",
      },
      {
        id: "go-portfolio",
        label: "Portfolio",
        hint: "Vault balances, orders, positions",
        group: "navigate",
        icon: Wallet,
        href: "/portfolio",
      },
    ];

    const trade: CommandItem[] = [
      {
        id: "trade-del",
        label: "Deliverable forwards",
        hint: "Lock the rate, get the currency",
        group: "trade",
        icon: Layers,
        href: "/trade?inst=deliverable",
      },
      {
        id: "trade-diff",
        label: "Differential perps",
        hint: "Up to 100× leverage",
        group: "trade",
        icon: TrendingUp,
        href: "/trade?inst=differential",
      },
    ];

    const wc: CommandItem[] = topTeams(6).map((t) => ({
      id: `wc-${t.team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: `${t.team} to win the World Cup`,
      hint: `${t.polymarketPct ?? "—"} implied · Group ${t.group ?? "?"}`,
      group: "wc" as const,
      icon: Trophy,
      href: `/wc#${t.team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    }));

    return [...nav, ...trade, ...wc];
  }, []);
}

/**
 * Global ⌘K command palette. Toggle via `useUiStore`.
 *
 * Searches across navigation, trade instrument shortcuts, and the top WC2026
 * outright markets. Results filter on substring match in label OR hint.
 */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const router = useRouter();
  const commands = useCommands();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Defer focus so it lands after the dialog mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered, activeIndex]);

  function execute(item: CommandItem) {
    close();
    router.push(item.href);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) execute(item);
    }
  }

  const grouped = useMemo(() => {
    const out: Record<CommandItem["group"], CommandItem[]> = { navigate: [], trade: [], wc: [] };
    for (const c of filtered) out[c.group].push(c);
    return out;
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <DialogContent
        showClose={false}
        className="top-[20%] max-w-2xl translate-y-0 overflow-hidden p-0"
      >
        <VisuallyHidden asChild>
          <DialogTitle>Command palette</DialogTitle>
        </VisuallyHidden>
        <div className="border-b border-[var(--color-line-1)] px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search markets, navigate, jump to anything…"
            className="w-full bg-transparent text-[15px] text-[var(--color-fg-0)] placeholder:text-[var(--color-fg-3)] focus:outline-none"
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--color-fg-2)]">No matches</div>
          ) : (
            (
              [
                ["navigate", "Navigate"],
                ["trade", "Predict FX"],
                ["wc", "Predict WC markets"],
              ] as const
            ).map(([group, label]) => {
              const items = grouped[group];
              if (items.length === 0) return null;
              return (
                <div key={group} className="px-2 py-2">
                  <div className="px-3 pb-1 pt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-3)]">
                    {label}
                  </div>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const idxInFiltered = filtered.indexOf(item);
                    const isActive = idxInFiltered === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => execute(item)}
                        onMouseEnter={() => setActiveIndex(idxInFiltered)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                          isActive
                            ? "bg-[var(--color-bg-2)] text-[var(--color-fg-0)]"
                            : "text-[var(--color-fg-1)]",
                        )}
                      >
                        <Icon className="size-4 text-[var(--color-fg-2)]" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--color-fg-0)]">
                            {item.label}
                          </div>
                          <div className="text-xs text-[var(--color-fg-2)]">{item.hint}</div>
                        </div>
                        <ArrowRight
                          className={cn(
                            "size-3.5 text-[var(--color-fg-3)] transition-opacity",
                            isActive ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--color-line-1)] px-4 py-2 text-[11px] text-[var(--color-fg-3)]">
          <span>
            <kbd className="rounded bg-[var(--color-bg-2)] px-1 font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded bg-[var(--color-bg-2)] px-1 font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded bg-[var(--color-bg-2)] px-1 font-mono">esc</kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
