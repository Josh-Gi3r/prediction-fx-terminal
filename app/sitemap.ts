import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-app.example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/swap",
    "/trade",
    "/trade/pro",
    "/wc",
    "/wc/props",
    "/wc/groups",
    "/wc/matches",
    "/wc/bracket",
    "/wc/boot",
    "/cash",
    "/earn",
    "/portfolio",
    "/legal/terms",
    "/legal/privacy",
  ];
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "daily",
    priority: path === "" ? 1 : 0.7,
  }));
}
