"use client";

import { type CorridorRegion, REGIONS } from "@/lib/corridors/registry";

interface Props {
  active: "all" | CorridorRegion;
  onChange: (r: "all" | CorridorRegion) => void;
}

export function CategoryChips({ active, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {REGIONS.map((r) => {
        const isActive = active === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            style={{
              fontFamily: "var(--f-ui)",
              fontWeight: 600,
              fontSize: 13.5,
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: isActive ? "var(--navy)" : "#fff",
              color: isActive ? "#fff" : "var(--ink-2)",
              cursor: "pointer",
              transition: "border-color .15s, background .15s, color .15s",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand-3)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
              }
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
