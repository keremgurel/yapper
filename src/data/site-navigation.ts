import { featureGroups } from "@/data/marketing-navigation";
import { marketingFeatures } from "@/data/marketing-features";

/**
 * The public site has three contexts. The brand pages introduce both
 * products; once a visitor is inside a product, the header only talks about
 * that product and offers one quiet link to the other.
 */
export type SiteContext = "brand" | "studio" | "train";

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

const STUDIO_PREFIXES = ["/products/studio", "/features", "/studio"];
const TRAIN_PREFIXES = [
  "/products/train",
  "/training",
  "/freestyle-speech",
  "/tools",
  "/blog",
  "/progress",
  "/history",
];

function under(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function siteContextFor(pathname: string | null): SiteContext {
  if (!pathname) return "brand";
  if (under(pathname, STUDIO_PREFIXES)) return "studio";
  if (under(pathname, TRAIN_PREFIXES)) return "train";
  return "brand";
}

export const trainPractice: NavColumn[] = [
  {
    title: "Everyday practice",
    links: [
      {
        label: "Random topic generator",
        href: "/training/random-topic-generator",
      },
      { label: "Freestyle speaking", href: "/freestyle-speech" },
      { label: "Read aloud", href: "/training/read-aloud" },
      {
        label: "Explain after reading",
        href: "/training/explain-after-reading",
      },
      { label: "Speaking warm-up", href: "/training/fluency-on-steroids" },
    ],
  },
  {
    title: "Real situations",
    links: [
      { label: "Interview answers", href: "/training/interview-prep" },
      { label: "Everyday conversations", href: "/training/dating" },
      { label: "Difficult conversations", href: "/training/conflict" },
      { label: "On-camera delivery", href: "/training/creator-camera-drills" },
    ],
  },
];

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
      { label: "Studio", href: "/products/studio" },
      { label: "Train", href: "/products/train" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  studio: {
    product: { label: "Studio", href: "/products/studio" },
    items: [
      {
        label: "Features",
        columns: studioFeatures,
        footer: { label: "All Studio features", href: "/features" },
      },
      { label: "Pricing", href: "/products/studio/pricing" },
    ],
    cta: { label: "Apply for the beta", href: "/products/studio#waitlist" },
    switchTo: { label: "Yapper Train", href: "/products/train" },
  },
  train: {
    product: { label: "Train", href: "/products/train" },
    items: [
      {
        label: "Practice",
        columns: trainPractice,
        footer: { label: "All exercises", href: "/training" },
      },
      { label: "AI feedback", href: "/products/train/ai-feedback" },
      { label: "Guides", href: "/blog" },
      { label: "Pricing", href: "/products/train/pricing" },
    ],
    cta: { label: "Start practicing", href: "/training" },
    switchTo: { label: "Yapper Studio", href: "/products/studio" },
  },
};
