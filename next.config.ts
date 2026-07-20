import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ypr.app" }],
        destination: "https://ypr.app/:path*",
        statusCode: 301,
      },
      // Legacy editor deep links (/studio?tab=feedback etc.) still resolve to
      // the editor. /studio itself is now the Studio marketing page
      // (src/app/studio/page.tsx), so there is no plain /studio redirect.
      {
        source: "/studio",
        has: [{ type: "query", key: "tab" }],
        destination: "/studio/editor",
        permanent: false,
      },
      // The Create hub became the Studio; ideation folded into the Content
      // Library (ideas now live there, imported from localStorage on first
      // visit).
      {
        source: "/create",
        destination: "/studio/library",
        permanent: false,
      },
      {
        source: "/ideation",
        destination: "/studio/library",
        permanent: true,
      },
      // Inspiration + Recorder moved into the Studio shell. Query strings
      // (e.g. the recorder's legacy ?idea=) are forwarded automatically.
      {
        source: "/inspiration",
        destination: "/studio/inspiration",
        permanent: true,
      },
      {
        source: "/record",
        destination: "/studio/recorder",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  experimental: {
    // Video uploads go directly to presigned R2 URLs, and editor transcription
    // is chunked below the hosting limit. Audio/full coaching still posts a
    // native WAV through /api/feedback, which can exceed Next's proxy default
    // for a long recording, so retain the larger self-host/local proxy ceiling.
    proxyClientMaxBodySize: "64mb",
  },
};

export default nextConfig;
