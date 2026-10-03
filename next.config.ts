import type { NextConfig } from "next";
import { studioHost, studioHostRedirects } from "./src/lib/routing/studio-host";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Studio on its own host. Empty until STUDIO_HOST is set, and listed
      // first so its front door wins over the /studio landing redirect.
      ...studioHostRedirects(studioHost(process.env)),
      // Legacy editor deep links (/studio?tab=feedback etc.) still resolve to
      // the editor. Listed before the plain /studio rule below, because
      // redirects match in order and that rule would otherwise take them.
      {
        source: "/studio",
        has: [{ type: "query", key: "tab" }],
        destination: "/studio/editor",
        permanent: false,
      },
      // Product overviews. /studio was the first Studio landing page;
      // /studio/* is the signed-in workspace and is not touched by this rule.
      { source: "/studio", destination: "/products/studio", permanent: true },
      // The brand homepage introduces both products, so the separate
      // comparison page was folded into it.
      { source: "/products", destination: "/", permanent: true },
      {
        source: "/products/yapper",
        destination: "/products/train",
        permanent: true,
      },
      // AI feedback is a Train feature and moved out of the Studio features
      // folder to sit with the product that owns it.
      {
        source: "/features/creator-feedback",
        destination: "/products/train/ai-feedback",
        permanent: true,
      },
      // Keep canonical slash handling in the static routing table rather than
      // running Clerk/Proxy for every crawler request to public content.
      {
        source: "/blog/",
        destination: "/blog",
        statusCode: 301,
      },
      {
        source: "/blog/:path+/",
        destination: "/blog/:path+",
        statusCode: 301,
      },
      // Straight to the final URL, so no old link takes two hops.
      {
        source: "/freestyle",
        destination: "/freestyle-speech",
        statusCode: 301,
      },
      {
        source: "/freestyle/",
        destination: "/freestyle-speech",
        statusCode: 301,
      },
      {
        source: "/freestyle-speech/",
        destination: "/freestyle-speech",
        statusCode: 301,
      },
      // The topic generator moved under /training so every practice tool lives
      // in one place. The old top-level URL is the one that ranks and the one
      // every published blog post links to, so it keeps a permanent redirect.
      {
        source: "/random-topic-generator",
        destination: "/training/random-topic-generator",
        statusCode: 301,
      },
      {
        source: "/random-topic-generator/",
        destination: "/training/random-topic-generator",
        statusCode: 301,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ypr.app" }],
        destination: "https://ypr.app/:path*",
        statusCode: 301,
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
  experimental: {
    // Video uploads go directly to presigned R2 URLs, and editor transcription
    // is chunked below the hosting limit. Audio/full coaching still posts a
    // native WAV through /api/feedback, which can exceed Next's proxy default
    // for a long recording, so retain the larger self-host/local proxy ceiling.
    proxyClientMaxBodySize: "64mb",
    // Keep a visited page in the client router cache for five minutes.
    // Studio pages are dynamic, and Next's default of 0s made every return
    // to a tab wait on a fresh server render even though its data is held
    // client-side. Data freshness is handled by the client resource cache.
    staleTimes: { dynamic: 300, static: 300 },
  },
};

export default nextConfig;
