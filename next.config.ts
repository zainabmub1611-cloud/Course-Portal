import type { NextConfig } from "next";

const appHostname = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: [
    "**.run.app",
    "**.google.com",
    "**.googleusercontent.com",
    "**.usercontent.goog",
    "127.0.0.1",
    ...(appHostname ? [appHostname] : []),
  ],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/uploads/:path*",
          destination: "/api/uploads/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
