/**
 * Safely stringify a value for embedding in a <script type="application/ld+json"> tag.
 * Escapes `<` to prevent XSS via `</script>` injection.
 */
export function safeJsonLdStringify(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export const SITE_URL = "https://ypr.app";

/**
 * Canonical site URL used for metadata and structured data.
 */
export function getSiteUrl(): string {
  return SITE_URL;
}
