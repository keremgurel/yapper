"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useStudioCta } from "@/hooks/use-studio-cta";

/** The primary Studio button on marketing pages: open Studio for members,
 * start the trial for everyone else. */
export default function StudioCtaButton({
  size,
  className,
  onClick,
}: {
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  onClick?: () => void;
}) {
  const cta = useStudioCta();
  return (
    <Button asChild size={size} className={className}>
      <Link href={cta.href} onClick={onClick}>
        {cta.label}
      </Link>
    </Button>
  );
}
