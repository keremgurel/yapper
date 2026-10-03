"use client";

import { useAuth } from "@clerk/nextjs";
import type { NavLink } from "@/data/site-navigation";

const STUDIO_PRICING = "/products/studio/pricing";

/**
 * The header button for the product being viewed. On Studio pages a
 * signed-in visitor is taken into Studio itself rather than offered the
 * trial again; any AI action there asks for a plan if they need one.
 */
export function useHeaderCta(cta: NavLink | undefined): NavLink | undefined {
  const { isSignedIn } = useAuth();
  if (cta?.href === STUDIO_PRICING && isSignedIn)
    return { label: "Open Studio", href: "/studio/home" };
  return cta;
}
