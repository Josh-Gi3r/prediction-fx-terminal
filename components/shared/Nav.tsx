"use client";

import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectButton } from "./ConnectButton";

// NEXT_PUBLIC_APP_NAME is set in .env.local / your deployment environment.
// Replace the logo image at /brand/logo.png with your own.
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "PredFX";

// NEXT_PUBLIC_FEATURE_EVENT_MODULE gates the bundled example event section (/wc).
// Set it to "false" in your env to drop the event nav item and disable the route.
const EVENT_MODULE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_EVENT_MODULE !== "false";

const BASE_NAV_ITEMS = [
  { href: "/trade", label: "Predict FX" },
  { href: "/swap", label: "Swap FX" },
  { href: "/cash", label: "P2P" },
  { href: "/earn", label: "Earn" },
  { href: "/portfolio", label: "Portfolio" },
] as const;

// Event module nav item is injected conditionally so the nav compiles fine
// without the WC2026 data even when the module is disabled.
const EVENT_NAV_ITEM = { href: "/wc", label: "Events" } as const;

/**
 * Top navigation bar.
 * Logo image: replace /brand/logo.png with your own asset.
 * Logo text: set via NEXT_PUBLIC_APP_NAME env var.
 * Event module nav item: controlled by NEXT_PUBLIC_FEATURE_EVENT_MODULE.
 */
export function Nav() {
  const pathname = usePathname();
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = EVENT_MODULE_ENABLED
    ? [BASE_NAV_ITEMS[0], EVENT_NAV_ITEM, ...BASE_NAV_ITEMS.slice(1)]
    : [...BASE_NAV_ITEMS];

  // Cmd+K (or Ctrl+K) opens the command palette anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommandPalette]);

  // Close mobile menu on route change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="nav ds4">
      <div className="wrap nav-inner">
        {/* Logo — replace /brand/logo.png with your own image */}
        <Link className="logo" href="/" aria-label={`${APP_NAME} home`}>
          <Image
            className="mark"
            src="/brand/logo.png"
            alt={APP_NAME}
            width={34}
            height={34}
            priority
          />
          <span className="word">{APP_NAME}</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="nav-links nav-desktop-links" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(active && "active")}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="nav-right">
          {/* Cmd+K command palette — desktop only */}
          <button
            type="button"
            onClick={toggleCommandPalette}
            aria-label="Open command palette (⌘K)"
            className="netsel nav-cmd-btn"
          >
            ⌘K
          </button>

          <ConnectButton />

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="nav-hamburger"
          >
            <span className="hb" data-open={mobileOpen} />
            <span className="hb" data-open={mobileOpen} />
            <span className="hb" data-open={mobileOpen} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <nav className="nav-mobile-drawer" aria-label="Mobile navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("nav-mobile-link", active && "active")}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      <style>{`
        .ds4 .nav-hamburger{display:none;flex-direction:column;justify-content:center;align-items:center;gap:5px;
          width:36px;height:36px;border-radius:9px;border:1px solid var(--line-2);background:#fff;cursor:pointer;padding:0;flex:0 0 auto}
        .ds4 .nav-hamburger .hb{display:block;width:16px;height:2px;border-radius:2px;background:var(--ink-2);transition:transform .2s,opacity .2s}
        .ds4 .nav-hamburger .hb[data-open="true"]:nth-child(1){transform:translateY(7px) rotate(45deg);background:var(--brand)}
        .ds4 .nav-hamburger .hb[data-open="true"]:nth-child(2){opacity:0}
        .ds4 .nav-hamburger .hb[data-open="true"]:nth-child(3){transform:translateY(-7px) rotate(-45deg);background:var(--brand)}
        .ds4 .nav-mobile-drawer{border-top:1px solid var(--line);background:#fff;padding:12px 18px 18px;display:flex;flex-direction:column;gap:2px}
        .ds4 .nav-mobile-link{font-weight:600;font-size:15px;color:var(--ink-2);padding:10px 14px;border-radius:9px}
        .ds4 .nav-mobile-link.active{color:var(--brand);background:var(--bg-tint)}
        @media (max-width:920px){
          .ds4 .nav-desktop-links{display:none}
          .ds4 .nav-cmd-btn{display:none}
          .ds4 .nav-netsel{display:none}
          .ds4 .nav-hamburger{display:flex}
        }
        @media (min-width:921px){
          .ds4 .nav-mobile-drawer{display:none}
        }
      `}</style>
    </header>
  );
}
