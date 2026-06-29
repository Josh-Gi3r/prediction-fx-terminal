import { Nav } from "@/components/shared/Nav";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="ds4">
      <Nav />
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          padding: "80px 28px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: "var(--muted-2)",
          }}
        >
          404 · Route not found
        </span>

        <h1
          style={{
            fontFamily: "var(--f-display)",
            fontWeight: 800,
            fontSize: "clamp(36px, 5vw, 60px)",
            letterSpacing: "-.02em",
            lineHeight: 1.05,
            margin: "14px 0 16px",
            color: "var(--ink)",
          }}
        >
          That market doesn&apos;t exist.
        </h1>

        <p
          style={{
            fontSize: 17,
            color: "var(--muted)",
            lineHeight: 1.6,
            maxWidth: 480,
            margin: "0 0 32px",
            fontFamily: "var(--f-ui)",
          }}
        >
          The page you&apos;re looking for isn&apos;t on FX Terminal. Try the FX corridors or the World
          Cup book instead.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <Link
            href="/trade"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              fontFamily: "var(--f-ui)",
              fontWeight: 700,
              fontSize: 15,
              padding: "13px 22px",
              borderRadius: 12,
              border: "1px solid transparent",
              background: "var(--grad-brand)",
              color: "#fff",
              boxShadow: "var(--sh-brand)",
              textDecoration: "none",
            }}
          >
            Predict FX markets
          </Link>
          <Link
            href="/wc"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              fontFamily: "var(--f-ui)",
              fontWeight: 700,
              fontSize: 15,
              padding: "13px 22px",
              borderRadius: 12,
              border: "1px solid var(--line-2)",
              background: "#fff",
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            Predict WC
          </Link>
        </div>
      </main>
    </div>
  );
}
