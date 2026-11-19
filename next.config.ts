import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/**": ["./public/demo/**/*"],
  },
};

export default nextConfig;
