import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql', 'better-sqlite3', '@prisma/adapter-better-sqlite3'],
};

export default nextConfig;
