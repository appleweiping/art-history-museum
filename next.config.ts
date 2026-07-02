import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Commons images are already CDN-served at whitelisted thumb widths; the
    // stored URLs must be used verbatim (arbitrary widths return HTTP 400),
    // so we bypass the Vercel optimizer entirely.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "upload.wikimedia.org" }],
  },
};

export default nextConfig;
