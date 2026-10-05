/**
 * Studio as its own site at studio.ypr.app, with ypr.app as the website.
 *
 * Everything here is off until `STUDIO_HOST` is set, so the code can ship
 * before the domain resolves. The app keeps its `/studio/...` paths on the
 * new host; what changes is which host serves them to a browser.
 *
 * Three things stay on the main host on purpose:
 * - The Mac app loads `ypr.app/studio/...` and trusts only that host, so its
 *   requests (user agent `YapperStudioNative/`) are never redirected.
 * - `/studio/native-auth` and `/studio/handoff` are the Mac app's sign-in
 *   handoff, opened in the browser, and stay where the app sends them.
 * - Connecting a publishing account starts on the main host, because the
 *   callback addresses registered with each platform are on ypr.app.
 */

import type { Header, Redirect } from "next/dist/lib/load-custom-routes";

export type HostRedirect = Redirect;

const NATIVE_USER_AGENT = ".*YapperStudioNative/.*";

/** The Studio host from the environment, or null while it is switched off. */
export function studioHost(env: Record<string, string | undefined>) {
  const host = env.STUDIO_HOST?.trim().toLowerCase();
  return host ? host : null;
}

export function studioHostRedirects(
  studio: string | null,
  main = "ypr.app",
): HostRedirect[] {
  if (!studio) return [];
  const onStudio = [{ type: "host" as const, value: studio }];
  return [
    // The app's front door.
    {
      source: "/",
      destination: "/studio/home",
      has: onStudio,
      permanent: false,
    },
    {
      source: "/studio",
      destination: "/studio/home",
      has: onStudio,
      permanent: false,
    },
    // Publishing accounts connect through the main host (see above).
    {
      source: "/api/publish/connect/:platform",
      destination: `https://${main}/api/publish/connect/:platform`,
      has: onStudio,
      permanent: false,
    },
    // Anything that is not the app, its API or its assets belongs to the
    // website.
    {
      source:
        "/:path((?!studio/|api/|_next/|__clerk|monitoring)(?!.*\\.[a-z0-9]+$).+)",
      destination: `https://${main}/:path`,
      has: onStudio,
      permanent: false,
    },
    // Browsers on the main host move to the Studio host. The Mac app and its
    // sign-in handoff stay put.
    {
      source: "/studio/:path((?!native-auth|handoff).+)",
      destination: `https://${studio}/studio/:path`,
      has: [{ type: "host", value: main }],
      missing: [
        { type: "header", key: "user-agent", value: NATIVE_USER_AGENT },
      ],
      permanent: false,
    },
  ];
}

/**
 * The Studio host is a signed-in app with nothing to rank, and the public
 * Studio pages live on the main host. Tell search engines to leave every
 * response on the Studio host out of the index.
 */
export function studioHostHeaders(studio: string | null): Header[] {
  if (!studio) return [];
  return [
    {
      source: "/:path*",
      has: [{ type: "host", value: studio }],
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ];
}
