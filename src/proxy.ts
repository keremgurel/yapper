import { NextResponse, type NextRequest } from "next/server";

const canonicalNoSlashPrefixes = [
  "/blog",
  "/freestyle",
  "/freestyle-speech",
  "/random-topic-generator",
];

export function proxy(request: NextRequest) {
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
}

export const config = {
  matcher: [
    "/((?!api|ingest|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
