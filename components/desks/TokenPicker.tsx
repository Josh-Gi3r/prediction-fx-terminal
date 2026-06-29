"use client";

import { currencyFlag } from "@/lib/desks/currency";
import { fmt, fromRaw } from "@/lib/fx-provider/core/format";
import type { FxToken } from "@/lib/fx-provider/core/types";
import { useMemo, useState } from "react";

export function TokenPicker({
  tokens,
  balances,
  title = "Select a token",
  excludeAddress,
  onSelect,
  onClose,
}: {
  tokens: FxToken[];
  balances?: Record<string, string>; // symbol -> raw uint256
  title?: string;
  excludeAddress?: string;
  onSelect: (t: FxToken) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return tokens.filter((t) => {
      if (excludeAddress && t.address.toLowerCase() === excludeAddress.toLowerCase()) return false;
      if (!query) return true;
      return (
        t.symbol.toLowerCase().includes(query) ||
        (t.name ?? "").toLowerCase().includes(query) ||
        (t.currency ?? "").toLowerCase().includes(query)
      );
    });
  }, [tokens, q, excludeAddress]);

  return (
    <>
      <PickerStyles />
      <div
        className="pk-back on"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="pk">
          <div className="pk-h">
            <h3>{title}</h3>
            <button type="button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="pk-s">
            <input
              // biome-ignore lint/a11y/noAutofocus: modal search box — focusing it is the point
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or symbol…"
              autoComplete="off"
            />
          </div>
          <div className="pk-list">
            {list.length === 0 && (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted-2)" }}>
                No tokens match.
              </div>
            )}
            {list.map((t) => {
              const raw = balances?.[t.symbol];
              const human = raw ? Number(fromRaw(raw, t.decimals)) : 0;
              const srcs = t.sources ?? [];
              const hasDex = srcs.some((s) => s !== "fx-provider");
              const hasFxProvider = srcs.includes("fx-provider");
              const badge = hasDex
                ? hasFxProvider
                  ? { label: "FX Provider + DEX", fx: false }
                  : { label: "DEX", fx: false }
                : { label: "FX Provider", fx: true };
              return (
                <button
                  type="button"
                  key={t.address}
                  className="pk-row"
                  onClick={() => onSelect(t)}
                >
                  <span className="fl">{currencyFlag(t.currency)}</span>
                  <span>
                    <span className="sy">{t.symbol}</span>
                    <br />
                    <span className="nm">{t.name ?? t.currency}</span>
                  </span>
                  {human > 0 ? (
                    <span className="bal">{fmt(human, 2)}</span>
                  ) : (
                    <span className={`badge${badge.fx ? " fx" : ""}`}>{badge.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/** Token-picker CSS transplanted verbatim from design-v2 swap.html, .ds4-scoped. */
function PickerStyles() {
  return (
    <style>{`
.ds4 .pk-back{position:fixed;inset:0;z-index:90;background:rgba(11,20,55,.42);backdrop-filter:blur(3px);display:none;align-items:flex-start;justify-content:center;padding:80px 16px}
.ds4 .pk-back.on{display:flex}
.ds4 .pk{width:100%;max-width:420px;background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-3);overflow:hidden}
.ds4 .pk-h{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}
.ds4 .pk-h h3{font-family:var(--f-display);font-weight:800;font-size:17px;color:var(--ink);margin:0}
.ds4 .pk-h button{border:0;background:var(--bg-soft);width:30px;height:30px;border-radius:8px;cursor:pointer;color:var(--muted);font-size:16px}
.ds4 .pk-s{padding:12px 14px}
.ds4 .pk-s input{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-family:var(--f-ui);font-size:14px;outline:none}
.ds4 .pk-s input:focus{border-color:var(--brand)}
.ds4 .pk-list{max-height:48vh;overflow-y:auto;padding:0 8px 10px}
.ds4 .pk-row{display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:0;background:none;padding:11px 10px;border-radius:11px;cursor:pointer;transition:.12s}
.ds4 .pk-row:hover{background:var(--bg-soft)}
.ds4 .pk-row .fl{font-size:21px;line-height:1}
.ds4 .pk-row .sy{font-family:var(--f-ui);font-weight:800;font-size:15px;color:var(--ink)}
.ds4 .pk-row .nm{font-size:12px;color:var(--muted)}
.ds4 .pk-row .bal{margin-left:auto;font-family:var(--f-tech);font-size:12px;color:var(--muted)}
.ds4 .pk-row .badge{margin-left:auto;font-family:var(--f-tech);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--brand);background:var(--bg-tint);padding:3px 7px;border-radius:6px}
.ds4 .pk-row .badge.fx{color:#9a4f12;background:#fff3e6}
`}</style>
  );
}
