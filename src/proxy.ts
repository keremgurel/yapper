import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isStudioPage = createRouteMatcher(["/studio/(.*)"]);
// Both handoffs must render for a signed-OUT visitor: each exists precisely to
// establish a session, so protecting them would bounce the arriving device to
// sign-in before it could redeem its ticket.
const isNativeAuthHandoff = createRouteMatcher([
  "/studio/native-auth(.*)",
  "/studio/handoff",
]);
const isProtectedApi = createRouteMatcher([
  // The catalog admin. Behind the same session gate as everything else, and
  // behind an id allowlist inside the handler, which answers 404 rather than
  // 403 so it does not announce itself.
  "/api/admin(.*)",
  "/api/billing(.*)",
  "/api/brand(.*)",
  "/api/brain(.*)",
  "/api/chirpy(.*)",
  "/api/clean-transcript",
  "/api/content(.*)",
  "/api/feedback",
  "/api/generate(.*)",
  "/api/ideas(.*)",
  "/api/inspiration(.*)",
  "/api/media(.*)",
  "/api/place-overlays",
  "/api/project(.*)",
  "/api/publish(.*)",
  "/api/storage(.*)",
  "/api/submissions(.*)",
  "/api/transcribe(.*)",
  "/api/transcription-dictionary(.*)",
  "/api/views(.*)",
  "/api/handoff(.*)",
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
  if (nativeShell) return;

  await auth.protect();
});

export const config = {
  matcher: [
    // /studio itself is a static marketing page; authenticated tools are below it.
    "/studio/:path+",
    "/api/admin/:path*",
    "/api/billing/:path*",
    "/api/brand/:path*",
    "/api/brain/:path*",
    "/api/chirpy/:path*",
    "/api/clean-transcript",
    "/api/content/:path*",
    "/api/feedback",
    "/api/generate/:path*",
    "/api/ideas/:path*",
    "/api/inspiration/:path*",
    "/api/media/:path*",
    "/api/place-overlays",
    // Scene handlers return their own JSON 401, but still need Clerk context.
    "/api/direct-overlays",
    "/api/design-overlays",
    "/api/revise-overlay",
    "/api/review-overlay",
    "/api/project/:path*",
    "/api/publish/:path*",
    "/api/storage/:path*",
    "/api/submissions/:path*",
    "/api/transcribe/:path*",
    "/api/transcribe",
    "/api/transcription-dictionary/:path*",
    "/api/views/:path*",
    "/api/handoff/:path*",
    "/__clerk/:path*",
  ],
};
