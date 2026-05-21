import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No TypeScript errors — ignoreBuildErrors removed
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql'],
};

export default nextConfig;
