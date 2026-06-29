import { Hero } from "@/components/landing/hero";
import { Products } from "@/components/landing/products";
import { WcPreview } from "@/components/landing/wc-preview";
import { Footer } from "@/components/shared/Footer";
import { Nav } from "@/components/shared/Nav";

/**
 * Home page — transplanted verbatim from design-v2's index.html.
 *
 * The shared shell classes (.wrap, .eyebrow, .btn, .card, .s-hero, …) live in
 * app/design.css. index.html's home-only <style> block (hero copy layout, stat
 * strip, product tiles, WC odds table) was NOT merged into design.css, so it is
 * transplanted verbatim below — scoped under .ds4 to match the design system.
 */
export default function HomePage() {
  return (
    <div className="ds4">
      <Nav />
      <main>
        <Hero />
        <Products />
        <WcPreview />
      </main>
      <Footer />

      {/* HOME-only layout — verbatim from design-v2 index.html <style> */}
      <style>{`
        .ds4 .hero-copy{max-width:540px}
        .ds4 .hero-copy h1{margin:16px 0 18px}
        .ds4 .hero-copy .lead{max-width:500px;margin-bottom:28px}
        .ds4 .hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:34px}
        .ds4 .statstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:0;background:#fff;border:1px solid var(--line);
          border-radius:var(--r);box-shadow:var(--sh-2);overflow:hidden;max-width:560px}
        .ds4 .statstrip .s{padding:16px 18px;border-right:1px solid var(--line)}
        .ds4 .statstrip .s:last-child{border-right:0}
        .ds4 .statstrip .sl{font-family:var(--f-tech);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-2)}
        .ds4 .statstrip .sv{font-family:var(--f-display);font-weight:800;font-size:30px;letter-spacing:-.02em;line-height:1.1;margin:3px 0 1px;color:#0a0e1a}
        .ds4 .statstrip .su{font-size:12px;color:var(--muted)}

        /* products */
        .ds4 .prod-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:36px}
        .ds4 .prod{position:relative;overflow:hidden;display:flex;flex-direction:column}
        .ds4 .prod .prod-art{height:140px;position:relative;border-radius:14px;overflow:hidden;margin-bottom:18px;
          background:linear-gradient(150deg,#eef4ff,#e0ebff)}
        .ds4 .prod .prod-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 28%;display:block}
        .ds4 .prod h3{margin-bottom:8px}
        .ds4 .prod p{color:var(--muted);font-size:14.5px;margin:0 0 14px}
        .ds4 .prod ul{list-style:none;padding:0;margin:0 0 18px;display:flex;flex-direction:column;gap:9px}
        .ds4 .prod li{font-size:13.5px;color:var(--ink-2);display:flex;gap:9px;align-items:flex-start}
        .ds4 .prod li::before{content:"";flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-top:7px}
        .ds4 .prod .open{margin-top:auto;display:inline-flex;align-items:center;gap:7px;font-weight:700;color:var(--brand);font-size:14px}
        .ds4 .pico{position:absolute;top:12px;left:12px;width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;
          background:#fff;box-shadow:var(--sh-1);z-index:2}

        /* WC teaser table */
        .ds4 .wc-tease{background:var(--bg-soft)}
        .ds4 .otable{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--sh-2)}
        .ds4 .otable .oh,.ds4 .otable .orow{display:grid;grid-template-columns:54px 1fr 70px 1fr 110px;align-items:center;gap:12px;padding:13px 20px}
        .ds4 .otable .oh{background:var(--bg-soft);border-bottom:1px solid var(--line);
          font-family:var(--f-tech);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2)}
        .ds4 .otable .orow{border-bottom:1px solid var(--line)}
        .ds4 .otable .orow:last-child{border-bottom:0}
        .ds4 .otable .orow:hover{background:var(--bg-soft)}
        .ds4 .rk{font-family:var(--f-tech);font-weight:700;color:var(--muted-2);font-size:13px}
        .ds4 .team{display:flex;align-items:center;gap:11px;font-weight:700;font-size:15px}
        .ds4 .flagc{font-family:var(--f-tech);font-weight:700;font-size:11px;letter-spacing:.04em;color:var(--brand);
          background:var(--bg-tint);border:1px solid var(--line);border-radius:6px;padding:4px 7px;min-width:42px;text-align:center}
        .ds4 .grp{font-family:var(--f-tech);font-weight:600;color:var(--muted);font-size:13px}
        .ds4 .imp{display:flex;align-items:center;gap:10px}
        .ds4 .imp .bar{flex:1;height:6px;border-radius:999px;background:var(--bg-tint);overflow:hidden}
        .ds4 .imp .bar > i{display:block;height:100%;background:var(--grad-brand);border-radius:999px}
        .ds4 .imp .pct{font-family:var(--f-tech);font-weight:700;font-size:14px;width:38px}
        .ds4 .dk{font-family:var(--f-tech);font-weight:600;color:var(--up);text-align:right}

        @media (max-width:980px){
          .ds4 .statstrip{grid-template-columns:repeat(2,1fr)}
          .ds4 .statstrip .s:nth-child(2){border-right:0}
          .ds4 .prod-grid{grid-template-columns:1fr}
          .ds4 .otable .oh,.ds4 .otable .orow{grid-template-columns:40px 1fr 60px 90px}
          .ds4 .otable .imp{display:none}
        }
      `}</style>
    </div>
  );
}
