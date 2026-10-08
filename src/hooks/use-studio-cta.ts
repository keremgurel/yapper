"use client";

import { useAuth } from "@clerk/nextjs";
import { useBillingStatus } from "@/hooks/use-billing-status";

export interface StudioCta {
  label: string;
  href: string;
  /** True when the visitor already has a Studio plan or trial. */
  member: boolean;
}

const TRIAL: StudioCta = {
  label: "Start your free trial",
  href: "/pricing",
  member: false,
};
const OPEN: StudioCta = {
  label: "Open Studio",
  href: "/studio/home",
  member: true,
};

/**
 * The one Studio call to action for whoever is looking: someone with a plan
 * opens Studio, everyone else starts the trial. The billing status is only
 * requested for signed-in visitors.
 */
export function useStudioCta(): StudioCta {
  const { isSignedIn } = useAuth();
  const { status } = useBillingStatus(isSignedIn === true);
  return isSignedIn && status?.entitled ? OPEN : TRIAL;
}
