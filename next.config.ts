import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js config options
};

// Minimal Sentry config for Cloudflare Pages deployment
// DSN configured via NEXT_PUBLIC_SENTRY_DSN environment variable
export default withSentryConfig(nextConfig, {});
