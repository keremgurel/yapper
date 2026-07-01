import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// Blog/practice routes are canonical without a trailing slash — 301 to strip it.
const canonicalNoSlashPrefixes = [
  "/blog",
  "/freestyle",
  "/freestyle-speech",
  "/random-topic-generator",
];

// Clerk runs on every matched request (attaching auth context); the existing
// canonical-redirect logic lives inside the same proxy so there's still a
// single proxy file, per Next 16.
export default clerkMiddleware((_auth, request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if (
    pathname.length > 1 &&
    pathname.endsWith("/") &&
    canonicalNoSlashPrefixes.some(
      (prefix) =>
        pathname === `${prefix}/` || pathname.startsWith(`${prefix}/`),
    )
  ) {
    const url = new URL(
      `${pathname.slice(0, -1)}${request.nextUrl.search}`,
      request.url,
    );
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Pages (skip Next internals, analytics ingest, static files).
    "/((?!api|ingest|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
    // Always run on API routes and Clerk's auto-proxy path.
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
