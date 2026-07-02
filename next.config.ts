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
      // The editor moved to /studio/editor; /studio becomes the Studio
      // dashboard. Order matters: the ?tab deep links (feedback etc.) must hit
      // the editor rule before the plain fallback. 307s on purpose (not
      // cacheable): /studio's meaning changes again when the dashboard lands.
      {
        source: "/studio",
        has: [{ type: "query", key: "tab" }],
        destination: "/studio/editor",
        permanent: false,
      },
      {
        source: "/studio",
        destination: "/studio/library",
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
};

export default nextConfig;
