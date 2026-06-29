"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * World Cup 2026 event promo popup — part of the bundled WC2026 example event module.
 * 
 * Slides in ~0.8s after load. Shows on EVERY page load (desktop, mobile,
 * Telegram) — dismissing hides it until the next load, nothing persists.
 *
 * Two modes:
 * - default (providers.tsx): landing page only, CTA links to /wc
 * - mobile (MobileApp home tab): parent gates when it renders, CTA switches
 *   to the in-app WC tab instead of leaving the mobile shell
 */
const DELAY_MS = 900;
// In-memory only: popup re-appears on every full page load, but dismissing it
// keeps it away for the rest of the current load (incl. SPA route changes).
let dismissedThisLoad = false;

interface WcPromoPopupProps {
  mobile?: { onGoWc: () => void };
}

export function WcPromoPopup({ mobile }: WcPromoPopupProps = {}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Desktop promo only on the landing page — it must NEVER cover app screens,
    // predictions, swap, p2p (its overlay blocks all clicks underneath).
    // Mobile mode: the parent only renders this on the home tab, so no route gate.
    if (!mobile && pathname !== "/") return;
    if (dismissedThisLoad) return;
    setMounted(true);
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [pathname, mobile]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted]);

  function close() {
    setOpen(false);
    dismissedThisLoad = true;
  }

  if (!mounted) return null;

  return (
    <>
      <style>{POPUP_CSS}</style>
      {/* biome-ignore lint/a11y/useSemanticElements: overlay needs a div for the backdrop blur + animation */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wcpop-title"
        className={`wcpop-overlay${open ? " open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="wcpop" role="document">
          <img className="wcpop-art" src="/brand/wc-popup.jpg" alt="" />
          <button className="wcpop-x" type="button" aria-label="Close" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="wcpop-copy">
            <span className="wcpop-badge">
              <span className="dot" />
              World Cup 2026 · markets live
            </span>
            <h2 id="wcpop-title">
              Back your team.
              <br />
              <span className="blue">Get paid if you&apos;re right.</span>
            </h2>
            <p>
              Trade <strong>YES / NO</strong> on all 104 matches and settle your winnings in the
              stablecoin of your choice.
            </p>
            <ul className="wcpop-points">
              <li>Positions from $1, no leverage needed</li>
              <li>Resolves on the official match result</li>
              <li>Outrights, golden boot &amp; specials too</li>
            </ul>
            <div className="wcpop-cta">
              {mobile ? (
                <button
                  className="wcpop-btn"
                  type="button"
                  onClick={() => {
                    close();
                    mobile.onGoWc();
                  }}
                >
                  Go to World Cup markets
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M3 8h9M8 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : (
                <Link className="wcpop-btn" href="/wc" onClick={close}>
                  Go to World Cup markets
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M3 8h9M8 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              )}
              <button className="wcpop-later" type="button" onClick={close}>
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const POPUP_CSS = `
.wcpop-overlay{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,14,26,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .28s ease}
.wcpop-overlay.open{opacity:1;pointer-events:auto}
.wcpop{position:relative;width:min(880px,100%);min-height:430px;border-radius:var(--r-xl,28px);overflow:hidden;background:#fff;box-shadow:0 40px 90px rgba(5,10,30,.45);display:flex;align-items:stretch;transform:translateY(22px) scale(.97);opacity:0;transition:transform .34s cubic-bezier(.2,.9,.25,1.15),opacity .28s ease}
.wcpop-overlay.open .wcpop{transform:translateY(0) scale(1);opacity:1}
.wcpop-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:78% 22%}
.wcpop::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(255,255,255,.97) 0%,rgba(255,255,255,.92) 36%,rgba(255,255,255,.45) 55%,rgba(255,255,255,0) 70%)}
.wcpop-copy{position:relative;z-index:2;align-self:center;max-width:430px;padding:44px 0 44px 44px}
.wcpop-copy h2{font-family:var(--f-display,"Sora",system-ui,sans-serif);font-weight:800;letter-spacing:-.02em;line-height:1.05;font-size:clamp(28px,3vw,38px);margin:14px 0 12px;color:var(--ink,#0a0e1a)}
.wcpop-copy h2 .blue{color:var(--brand,#2563eb)}
.wcpop-copy p{color:var(--muted,#5e6a82);font-size:15.5px;line-height:1.6;font-weight:500;margin:0 0 20px;max-width:360px}
.wcpop-copy p strong{color:var(--ink,#0a0e1a)}
.wcpop-points{list-style:none;padding:0;margin:0 0 24px;display:flex;flex-direction:column;gap:9px}
.wcpop-points li{font-size:13.5px;font-weight:600;color:var(--ink-2,#1c2740);display:flex;gap:9px;align-items:flex-start}
.wcpop-points li::before{content:"";flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--accent,#10d9a0);margin-top:7px}
.wcpop-badge{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-tech,"Chakra Petch",system-ui,sans-serif);font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--no,#f0436a);padding:4px 10px;border-radius:999px;background:var(--no-soft,#fdebef)}
.wcpop-badge .dot{width:7px;height:7px;border-radius:50%;background:var(--no,#f0436a);box-shadow:0 0 0 0 rgba(240,67,106,.6);animation:wcpop-pulse 1.8s infinite}
@keyframes wcpop-pulse{0%{box-shadow:0 0 0 0 rgba(240,67,106,.5)}70%{box-shadow:0 0 0 7px rgba(240,67,106,0)}100%{box-shadow:0 0 0 0 rgba(240,67,106,0)}}
.wcpop-cta{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.wcpop-btn{display:inline-flex;align-items:center;gap:9px;cursor:pointer;text-decoration:none;font-family:var(--f-ui,"Manrope",system-ui,sans-serif);font-weight:700;font-size:15px;padding:13px 22px;border-radius:13px;border:1px solid transparent;background:var(--grad-brand,linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%));color:#fff;box-shadow:0 10px 26px rgba(37,99,235,.28);transition:.15s}
.wcpop-btn:hover{box-shadow:0 18px 44px rgba(37,99,235,.34)}
.wcpop-btn:active{transform:translateY(1px)}
.wcpop-later{background:none;border:0;cursor:pointer;font-family:var(--f-ui,"Manrope",system-ui,sans-serif);font-weight:700;font-size:14px;color:var(--muted,#5e6a82);padding:10px 6px}
.wcpop-later:hover{color:var(--ink,#0a0e1a)}
.wcpop-x{position:absolute;top:14px;right:14px;z-index:3;width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;background:rgba(10,14,26,.45);color:#fff;display:flex;align-items:center;justify-content:center;transition:.15s;backdrop-filter:blur(4px)}
.wcpop-x:hover{background:rgba(10,14,26,.7)}
@media (max-width:760px){
.wcpop-overlay{padding:14px}
.wcpop{min-height:0;border-radius:22px;max-height:calc(100dvh - 28px);max-height:calc(100vh - 28px);overflow-y:auto;-webkit-overflow-scrolling:touch}
.wcpop-art{inset:0 0 auto 0;height:272px;object-position:100% 26%}
.wcpop::after{inset:0 0 auto 0;height:272px;background:linear-gradient(0deg,rgba(255,255,255,1) 0%,rgba(255,255,255,.6) 16%,rgba(255,255,255,0) 34%)}
.wcpop-copy{max-width:100%;align-self:auto;padding:236px 22px 24px}
.wcpop-copy h2{font-size:clamp(26px,7.5vw,32px);margin:12px 0 10px}
.wcpop-copy p{font-size:14.5px;max-width:100%;margin-bottom:16px}
.wcpop-points{margin-bottom:20px;gap:8px}
.wcpop-cta{flex-direction:column;align-items:stretch;gap:6px}
.wcpop-btn{justify-content:center;padding:15px 22px}
.wcpop-later{padding:12px 6px}
.wcpop-x{top:10px;right:10px;width:36px;height:36px}
}
@media (max-width:760px) and (max-height:540px){
.wcpop-art{height:170px}
.wcpop::after{height:170px}
.wcpop-copy{padding-top:150px}
}
@media (prefers-reduced-motion:reduce){.wcpop-overlay,.wcpop{transition:none}}
`;
