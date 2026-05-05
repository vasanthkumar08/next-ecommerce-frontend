import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/settings", "/checkout", "/cart"],
    },
    sitemap: `${siteUrl.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
