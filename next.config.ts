import type { NextConfig } from "next";

/**
 * Browser-side hardening for a public demo. No CSP yet: Next's inline
 * bootstrap scripts need a nonce-per-request setup, which is a change to the
 * app shell rather than a header, and is listed in the security notes.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The resume skill guides are read from disk at runtime (src/lib/tailor/skills.ts),
  // which the tracer cannot see from the import graph. The plan agent on the
  // opening page uses them too.
  outputFileTracingIncludes: {
    "/jobs/**": ["src/lib/tailor/skills/*.md"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
