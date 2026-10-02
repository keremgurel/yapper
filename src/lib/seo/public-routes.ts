import routes from "./public-routes.json";
import { SITEMAP_LASTMOD } from "./sitemap-lastmod-generated";

/**
 * Every indexable public page that is not a blog post, with the product that
 * owns it and the source files whose history counts as a change to it. The
 * sitemap, the lastmod generator and the SEO audit all read this one list, so
 * a page cannot be in one and missing from another. Blog posts carry their own
 * dates in frontmatter and are added by the sitemap.
 */
export type RouteOwner = "brand" | "studio" | "train";

export const PUBLIC_ROUTES = routes as Record<
  string,
  { product: RouteOwner; sources: string[] }
>;

export const PUBLIC_PATHS = Object.keys(PUBLIC_ROUTES);

/** The date a page's own files last changed. Undefined until the generator
 * has run for a newly added route, in which case the sitemap omits lastmod
 * instead of inventing one. */
export function routeLastmod(path: string): Date | undefined {
  const date = (SITEMAP_LASTMOD as Record<string, string | undefined>)[path];
  return date ? new Date(`${date}T00:00:00.000Z`) : undefined;
}
