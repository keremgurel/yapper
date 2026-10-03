"use client";

import Link from "next/link";
import StudioCtaButton from "@/components/marketing/studio-cta-button";
import { Button } from "@/components/ui/button";
import { useStudioCta } from "@/hooks/use-studio-cta";

/** The closing actions on Studio pages. A member gets one button into Studio;
 * everyone else can start the trial or look around Studio first. */
export default function StudioStartActions() {
  const { member } = useStudioCta();
  return (
    <div className="marketing-actions">
      <StudioCtaButton size="lg" />
      {!member && (
        <Button asChild size="lg" variant="outline">
          <Link href="/studio/home">Open Studio</Link>
        </Button>
      )}
    </div>
  );
}
