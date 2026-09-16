import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal and operational surfaces; nothing here belongs in an index
      disallow: ["/admin", "/savings", "/settings", "/notifications", "/api/"],
    },
    sitemap: `${BRAND.url}/sitemap.xml`,
  };
}
