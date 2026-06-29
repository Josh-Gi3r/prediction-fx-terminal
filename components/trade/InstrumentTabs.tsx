"use client";

import { useUiStore } from "@/stores/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const TABS = [
  {
    id: "deliverable" as const,
    label: "Deliverable forwards",
    description: "Lock the rate, get the currency. 1:1 collateral, no liquidations.",
    iconPath: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 7h14M3 13h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="7" cy="7" r="2.2" fill="white" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="13" cy="13" r="2.2" fill="white" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: "differential" as const,
    label: "FX Perps",
    description:
      "Long or short EM FX pairs with up to 100× leverage. Cash-settled in your stablecoin.",
    iconPath: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M3 14l4-5 3 3 6-8"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 4v4h-4"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function UrlSync() {
  const setInstrument = useUiStore((s) => s.setInstrument);
  const params = useSearchParams();
  useEffect(() => {
    const qp = params.get("inst");
    if (qp === "differential" || qp === "deliverable") setInstrument(qp);
  }, [params, setInstrument]);
  return null;
}

export function InstrumentTabs() {
  const instrument = useUiStore((s) => s.instrument);
  const setInstrument = useUiStore((s) => s.setInstrument);
  const router = useRouter();

  function pick(id: "deliverable" | "differential") {
    setInstrument(id);
    const search = id === "deliverable" ? "" : `?inst=${id}`;
    router.replace(`/trade${search}`, { scroll: false });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Suspense fallback={null}>
        <UrlSync />
      </Suspense>
      {TABS.map((t) => {
        const active = instrument === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            style={{
              background: active ? "linear-gradient(180deg,#fff,var(--bg-tint))" : "#fff",
              border: active ? "1px solid var(--brand)" : "1px solid var(--line)",
              borderRadius: 16,
              padding: 16,
              boxShadow: active ? "0 0 0 2px var(--brand-3), var(--sh-2)" : "var(--sh-1)",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color .15s, box-shadow .15s, transform .15s",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--sh-2)";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--sh-1)";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              }
            }}
          >
            {/* Radio indicator */}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 13,
                right: 13,
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: active ? "none" : "1.5px solid var(--line-2)",
                background: active ? "var(--brand)" : "#fff",
                boxShadow: active ? "inset 0 0 0 3px #fff" : "none",
                transition: ".15s",
              }}
            />

            {/* Icon */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: active ? "var(--grad-brand)" : "var(--bg-tint)",
                color: active ? "#fff" : "var(--brand)",
                marginBottom: 10,
              }}
            >
              {t.iconPath}
            </div>

            <h4
              style={{
                margin: "0 0 5px",
                fontFamily: "var(--f-display)",
                fontWeight: 700,
                fontSize: 15.5,
                color: "var(--ink)",
              }}
            >
              {t.label}
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: "var(--muted)",
                lineHeight: 1.45,
              }}
            >
              {t.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
