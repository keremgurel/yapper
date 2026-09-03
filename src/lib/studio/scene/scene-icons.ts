import { CURATED_ICON_NAMES, LUCIDE_ICON_NAMES } from "./lucide-icon-names";

/** True when the app can draw this icon: the same set it bundles. */
export function isKnownSceneIcon(name: unknown): name is string {
  return typeof name === "string" && LUCIDE_ICON_NAMES.has(name);
}

/** The names the designer prompt offers, as one comma separated line. */
export function curatedIconList(): string {
  return CURATED_ICON_NAMES.join(", ");
}
