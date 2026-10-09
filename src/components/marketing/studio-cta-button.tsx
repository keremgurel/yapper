"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** One consistent entry point into Studio from the public website. */
export default function StudioCtaButton({
  size,
  className,
  onClick,
}: {
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Button asChild variant="titanium" size={size} className={className}>
      <Link href="/studio/home" onClick={onClick}>
        Access Studio
      </Link>
    </Button>
  );
}
