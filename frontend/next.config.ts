import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const rewrites = [];

    // Proxy Supabase Auth through our own domain. Some ISPs/networks block
    // *.supabase.co directly (DNS/SNI filtering) even though the Vercel-hosted
    // site itself loads fine — this keeps every request same-origin so the
    // browser never talks to supabase.co directly.
    if (process.env.SUPABASE_ORIGIN) {
      rewrites.push({
        source: "/sb/:path*",
        destination: `${process.env.SUPABASE_ORIGIN}/:path*`,
      });
    }

    // Same treatment for the backend API host, in case it's filtered too.
    if (process.env.API_ORIGIN) {
      rewrites.push({
        source: "/api/:path*",
        destination: `${process.env.API_ORIGIN}/:path*`,
      });
    }

    return rewrites;
  },
};

export default nextConfig;
