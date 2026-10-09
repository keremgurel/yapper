import { featureGroups } from "@/data/marketing-navigation";
import { marketingFeatures } from "@/data/marketing-features";

/**
 * The public site is Studio. Speaking practice moved to speakingpractice.ai.
 */
export type SiteContext = "brand" | "studio";

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}
export interface NavColumn {
  title: string;
  links: NavLink[];
}
export interface NavPanel {
  label: string;
  columns: NavColumn[];
  footer: NavLink;
}
export type NavItem = NavLink | NavPanel;

export interface SiteNavigation {
  /** Shown beside the wordmark inside a product. */
  product?: NavLink;
  items: NavItem[];
  cta?: NavLink;
  /** The other product. */
  switchTo?: NavLink;
}

export function isPanel(item: NavItem): item is NavPanel {
  return "columns" in item;
}

const STUDIO_PREFIXES = [
  "/products/studio",
  "/features",
  "/studio",
  "/history",
];

function under(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function siteContextFor(pathname: string | null): SiteContext {
  if (!pathname) return "studio";
  if (under(pathname, STUDIO_PREFIXES)) return "studio";
  return "studio";
}

const studioFeatures: NavColumn[] = featureGroups.map((group) => ({
  title: group.title,
  links: group.slugs.map((slug) => ({
    label: marketingFeatures.find((feature) => feature.slug === slug)!
      .shortTitle,
    href: `/features/${slug}`,
  })),
}));

export const siteNavigation: Record<SiteContext, SiteNavigation> = {
  brand: {
    items: [
      { label: "Studio", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  studio: {
    product: { label: "Studio", href: "/" },
    items: [
      {
        label: "Features",
        columns: studioFeatures,
        footer: { label: "All Studio features", href: "/features" },
      },
      { label: "Pricing", href: "/pricing" },
      { label: "Blog", href: "/blog" },
    ],
    cta: { label: "Start free trial", href: "/pricing" },
  },
};
