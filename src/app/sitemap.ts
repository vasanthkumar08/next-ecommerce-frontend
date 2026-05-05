import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
  .replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/shop",
    "/shop/products",
    "/shop/wishlist",
    "/login",
    "/register",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/shop/products" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
