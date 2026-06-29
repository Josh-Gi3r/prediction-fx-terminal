"use client";

import { useEffect, useState } from "react";

/**
 * Predict FX teaser popup — shown on every load of the Predict FX surfaces
 * (desktop /trade and the mobile Predict FX tab). The product is in preview:
 * the popup hypes what is coming and invites people to play with the preview.
 * Dismissal is in-memory per load, same pattern as WcPromoPopup.
 *
 * Copy rule: payout examples are odds-based and labeled illustrative. No
 * yield/APY promises — the legal pages commit us to no-return-promises.
 */
const DELAY_MS = 900;
let dismissedThisLoad = false;

export function PredictFxPopup() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (dismissedThisLoad) return;
    setMounted(true);
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

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
        aria-labelledby="pfx-title"
        className={`pfx-overlay${open ? " open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="pfx" role="document">
          <img className="pfx-art" src="/brand/prod/predictions.jpg" alt="" />
          <button className="pfx-x" type="button" aria-label="Close" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="pfx-copy">
            <span className="pfx-badge">
              <span className="dot" />
              Predict FX · coming soon
            </span>
            <h2 id="pfx-title">
              The future of FX
              <br />
              <span className="blue">is a prediction market.</span>
            </h2>
            <p>
              Call where <strong>EUR/USD</strong>, <strong>USD/JPY</strong> or any major pair goes
              next. Right calls collect the full dollar on every contract.
            </p>
            <ul className="pfx-points">
              <li>Buy a YES at 25c, be right, collect $1. That is 4x on one call</li>
              <li>Forwards and differential perps on the same rails</li>
              <li>Settle winnings in the stablecoin of your choice</li>
            </ul>
            <div className="pfx-cta">
              <button className="pfx-btn" type="button" onClick={close}>
                Play with the preview
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
              <button className="pfx-later" type="button" onClick={close}>
                Maybe later
              </button>
            </div>
            <span className="pfx-fine">
              Preview with simulated data. Examples are illustrative.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

const POPUP_CSS = `
.pfx-overlay{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,14,26,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .28s ease}
.pfx-overlay.open{opacity:1;pointer-events:auto}
.pfx{position:relative;width:min(880px,100%);min-height:430px;border-radius:var(--r-xl,28px);overflow:hidden;background:#fff;box-shadow:0 40px 90px rgba(5,10,30,.45);display:flex;align-items:stretch;transform:translateY(22px) scale(.97);opacity:0;transition:transform .34s cubic-bezier(.2,.9,.25,1.15),opacity .28s ease}
.pfx-overlay.open .pfx{transform:translateY(0) scale(1);opacity:1}
.pfx-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:72% 30%}
.pfx::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(255,255,255,.97) 0%,rgba(255,255,255,.92) 36%,rgba(255,255,255,.45) 55%,rgba(255,255,255,0) 70%)}
.pfx-copy{position:relative;z-index:2;align-self:center;max-width:430px;padding:44px 0 44px 44px}
.pfx-copy h2{font-family:var(--f-display,"Sora",system-ui,sans-serif);font-weight:800;letter-spacing:-.02em;line-height:1.05;font-size:clamp(28px,3vw,38px);margin:14px 0 12px;color:var(--ink,#0a0e1a)}
.pfx-copy h2 .blue{color:var(--brand,#2563eb)}
.pfx-copy p{color:var(--muted,#5e6a82);font-size:15.5px;line-height:1.6;font-weight:500;margin:0 0 20px;max-width:360px}
.pfx-copy p strong{color:var(--ink,#0a0e1a)}
.pfx-points{list-style:none;padding:0;margin:0 0 24px;display:flex;flex-direction:column;gap:9px}
.pfx-points li{font-size:13.5px;font-weight:600;color:var(--ink-2,#1c2740);display:flex;gap:9px;align-items:flex-start}
.pfx-points li::before{content:"";flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--accent,#10d9a0);margin-top:7px}
.pfx-badge{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-tech,"Chakra Petch",system-ui,sans-serif);font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--brand,#2563eb);padding:4px 10px;border-radius:999px;background:rgba(37,99,235,.1)}
.pfx-badge .dot{width:7px;height:7px;border-radius:50%;background:var(--brand,#2563eb);box-shadow:0 0 0 0 rgba(37,99,235,.6);animation:pfx-pulse 1.8s infinite}
@keyframes pfx-pulse{0%{box-shadow:0 0 0 0 rgba(37,99,235,.5)}70%{box-shadow:0 0 0 7px rgba(37,99,235,0)}100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}}
.pfx-cta{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pfx-btn{display:inline-flex;align-items:center;gap:9px;cursor:pointer;text-decoration:none;font-family:var(--f-ui,"Manrope",system-ui,sans-serif);font-weight:700;font-size:15px;padding:13px 22px;border-radius:13px;border:1px solid transparent;background:var(--grad-brand,linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%));color:#fff;box-shadow:0 10px 26px rgba(37,99,235,.28);transition:.15s}
.pfx-btn:hover{box-shadow:0 18px 44px rgba(37,99,235,.34)}
.pfx-btn:active{transform:translateY(1px)}
.pfx-later{background:none;border:0;cursor:pointer;font-family:var(--f-ui,"Manrope",system-ui,sans-serif);font-weight:700;font-size:14px;color:var(--muted,#5e6a82);padding:10px 6px}
.pfx-later:hover{color:var(--ink,#0a0e1a)}
.pfx-fine{display:block;margin-top:14px;font-size:11.5px;font-weight:500;color:var(--muted,#8a93a8)}
.pfx-x{position:absolute;top:14px;right:14px;z-index:3;width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;background:rgba(10,14,26,.45);color:#fff;display:flex;align-items:center;justify-content:center;transition:.15s;backdrop-filter:blur(4px)}
.pfx-x:hover{background:rgba(10,14,26,.7)}
@media (max-width:760px){
.pfx-overlay{padding:14px}
.pfx{min-height:0;border-radius:22px;max-height:calc(100dvh - 28px);max-height:calc(100vh - 28px);overflow-y:auto;-webkit-overflow-scrolling:touch}
.pfx-art{inset:0 0 auto 0;height:272px;object-position:100% 30%}
.pfx::after{inset:0 0 auto 0;height:272px;background:linear-gradient(0deg,rgba(255,255,255,1) 0%,rgba(255,255,255,.6) 16%,rgba(255,255,255,0) 34%)}
.pfx-copy{max-width:100%;align-self:auto;padding:236px 22px 24px}
.pfx-copy h2{font-size:clamp(26px,7.5vw,32px);margin:12px 0 10px}
.pfx-copy p{font-size:14.5px;max-width:100%;margin-bottom:16px}
.pfx-points{margin-bottom:20px;gap:8px}
.pfx-cta{flex-direction:column;align-items:stretch;gap:6px}
.pfx-btn{justify-content:center;padding:15px 22px}
.pfx-later{padding:12px 6px}
.pfx-x{top:10px;right:10px;width:36px;height:36px}
}
@media (max-width:760px) and (max-height:540px){
.pfx-art{height:170px}
.pfx::after{height:170px}
.pfx-copy{padding-top:150px}
}
@media (prefers-reduced-motion:reduce){.pfx-overlay,.pfx{transition:none}}
`;
