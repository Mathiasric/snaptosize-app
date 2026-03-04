import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js config options
};

export default withSentryConfig(nextConfig, {
  org: "snaptosize",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Webpack-specific options (not supported with Turbopack in dev, but used in production)
  webpack: {
    // Automatically annotate React components to show their full name in breadcrumbs and session replay
    reactComponentAnnotation: {
      enabled: true,
    },
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    removeDebugLogging: true,
  },
});
