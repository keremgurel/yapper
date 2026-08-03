import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isStudioPage = createRouteMatcher(["/studio/(.*)"]);
const isNativeAuthHandoff = createRouteMatcher(["/studio/native-auth(.*)"]);
const isProtectedApi = createRouteMatcher([
  "/api/billing(.*)",
  "/api/clean-transcript",
  "/api/content(.*)",
  "/api/feedback",
  "/api/generate(.*)",
  "/api/ideas(.*)",
  "/api/inspiration(.*)",
  "/api/media(.*)",
  "/api/place-overlays",
  "/api/publish(.*)",
  "/api/submissions(.*)",
  "/api/transcribe",
  "/api/transcription-dictionary(.*)",
]);

// Authentication belongs only in front of Studio and routes that call Clerk's
// server helpers. Marketing, blog, and free-practice pages stay fully static,
// so crawler traffic cannot spend Fluid CPU merely by hitting a cached page.
export default clerkMiddleware(async (auth, request) => {
  if (isProtectedApi(request)) {
    await auth.protect();
    return;
  }

  if (!isStudioPage(request) || isNativeAuthHandoff(request)) return;

  // The native shell renders its own sign-in handoff, then establishes a real
  // Clerk session before it can call any protected API. Let that signed-out
  // shell render; the web version always redirects to Clerk first.
  const nativeShell = request.headers
    .get("user-agent")
    ?.includes("YapperStudioNative/");
  if (!nativeShell) await auth.protect();
});

export const config = {
  matcher: [
    // /studio itself is a static marketing page; authenticated tools are below it.
    "/studio/:path+",
    "/api/billing/:path*",
    "/api/clean-transcript",
    "/api/content/:path*",
    "/api/feedback",
    "/api/generate/:path*",
    "/api/ideas/:path*",
    "/api/inspiration/:path*",
    "/api/media/:path*",
    "/api/place-overlays",
    "/api/publish/:path*",
    "/api/submissions/:path*",
    "/api/transcribe",
    "/api/transcription-dictionary/:path*",
    "/__clerk/:path*",
  ],
};
