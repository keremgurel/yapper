/**
 * Safely stringify a value for embedding in a <script type="application/ld+json"> tag.
 * Escapes `<` to prevent XSS via `</script>` injection.
 */
export function safeJsonLdStringify(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/**
 * Canonical site URL, configurable via NEXT_PUBLIC_SITE_URL.
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://ypr.app";
}
