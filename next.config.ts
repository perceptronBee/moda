import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hackathon: TypeScript ve ESLint hatalarını build'de görmezden gel
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
