import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer bruger canvas internt — kør det kun server-side
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
