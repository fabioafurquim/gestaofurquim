import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Mantemos typecheck separado do build para o deploy no Coolify não derrubar a VPS.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
