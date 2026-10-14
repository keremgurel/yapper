/** Shared event contract. Never put scripts, prompts, filenames or tokens here. */
export const ANALYTICS_SCHEMA_VERSION = 1;

export function clientContext(userAgent: string) {
  const native = /YapperStudioNative\/([\w.+-]+)/.exec(userAgent);
  return {
    product: "studio",
    analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    surface: native ? "macos" : "web",
    client: native ? "native_webview" : "browser",
    ...(native ? { app_version: native[1] } : {}),
  };
}

/** Only route templates enter analytics; IDs and auth query strings do not. */
export function pageName(path: string) {
  return path
    .replace(/\/(?:user_|org_)[^/]+/g, "/:id")
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id")
    .replace(/(\/studio\/(?:ideas|library|canvas))\/[^/]+/g, "$1/:id");
}

/** Preserve campaign tags; remove auth tickets, search text and fragments. */
export function analyticsURL(raw: string) {
  try {
    const url = new URL(raw);
    const clean = new URL(pageName(url.pathname), url.origin);
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]) {
      const value = url.searchParams.get(key);
      if (value) clean.searchParams.set(key, value.slice(0, 200));
    }
    return clean.href;
  } catch {
    return "";
  }
}
