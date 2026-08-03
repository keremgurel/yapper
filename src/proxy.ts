import { clerkMiddleware } from "@clerk/nextjs/server";

// Authentication belongs only in front of Studio and routes that call Clerk's
// server helpers. Marketing, blog, and free-practice pages stay fully static,
// so crawler traffic cannot spend Fluid CPU merely by hitting a cached page.
export default clerkMiddleware();

export const config = {
  matcher: [
    // /studio itself is a static marketing page; authenticated tools are below it.
    "/studio/:path+",
    "/api/billing/:path*",
    "/api/content/:path*",
    "/api/feedback",
    "/api/generate/:path*",
    "/api/ideas/:path*",
    "/api/inspiration/:path*",
    "/api/media/:path*",
    "/api/publish/:path*",
    "/api/submissions/:path*",
    "/api/transcription-dictionary/:path*",
    "/__clerk/:path*",
  ],
};
