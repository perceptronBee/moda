import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/security/siteUrl";

export default function robots(): MetadataRoute.Robots {
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined;
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/kadin", "/erkek", "/yeni", "/indirim", "/urun/", "/magaza/"],
        disallow: [
          "/api/",
          "/hesap/",
          "/sepet",
          "/giris",
          "/kayit",
          "/sifre-sifirla",
          "/sifre-yenile",
          "/auth/",
          "/affiliate",
        ],
      },
    ],
    sitemap: siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
  };
}
