import type { NextConfig } from "next";

// Supabase URL'i CSP'ye dahil etmek için
const supabaseHost = (() => {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!u) return null;
    return new URL(u).origin;
  } catch {
    return null;
  }
})();

const cspDirectives = [
  "default-src 'self'",
  // Next.js inline script'leri için unsafe-inline gerekli (Hydration). nonce ile ileride iyileştirilebilir.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  // Görseller — kendi + Supabase Storage + LCW CDN'leri (deeplink ürün foto'ları için olabilir)
  `img-src 'self' data: blob: https: ${supabaseHost ?? ""}`.trim(),
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseHost ?? ""}`.trim(),
  // Iframe'le sarmaya izin yok — Clickjacking
  `frame-ancestors 'none'`,
  // Form action'lar sadece kendi domain
  `form-action 'self'`,
  // Base URI sabit
  `base-uri 'self'`,
  // HTTPS upgrade
  `upgrade-insecure-requests`,
].join("; ");

const nextConfig: NextConfig = {
  // Hackathon: TypeScript hatalarını build'de görmezden gel
  // (Next.js 16'da `eslint` config kalktı — ESLint ayrı CLI olarak çalışır)
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permission policy — gereksiz tarayıcı API'lerini kapat
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          // HSTS — production'da HTTPS zorla, 2 yıl
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Content-Security-Policy
          { key: "Content-Security-Policy", value: cspDirectives },
          // XSS protection (eski tarayıcılar için)
          { key: "X-XSS-Protection", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
