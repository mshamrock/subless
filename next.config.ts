import type { NextConfig } from "next";

const config: NextConfig = {
  // Several lockfiles exist above this directory; pin the trace root to this project
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  images: {
    // Narrow on purpose: a wildcard here turns /_next/image into an open image
    // proxy that anyone can point at any URL. Avatars are the only remote images
    // we render, and routing them through Next means visitors fetch them from
    // this origin rather than from GitHub.
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
};

export default config;
