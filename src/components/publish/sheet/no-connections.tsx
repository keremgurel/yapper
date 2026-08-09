"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio-ui";

/** Nothing to publish to yet. Names the next action rather than the absence. */
export default function NoConnections() {
  return (
    <EmptyState
      icon={Link2}
      title="No platforms connected"
      description="Connect YouTube, TikTok or Instagram and this video can go out from here."
      action={
        <Button asChild variant="outline">
          <Link href="/studio/connections">Go to Connections</Link>
        </Button>
      }
    />
  );
}
