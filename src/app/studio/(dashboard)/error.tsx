"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Keep Studio navigation available when a page's server data cannot load. */
export default function StudioPageError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <section role="alert" className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">
        This page couldn’t be loaded
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-6">
        Try again to load your workspace. You can also open another Studio page
        from the sidebar.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={() => unstable_retry()}>
          <RefreshCw aria-hidden className="h-4 w-4" /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/studio/home">Open Home</Link>
        </Button>
      </div>
    </section>
  );
}
