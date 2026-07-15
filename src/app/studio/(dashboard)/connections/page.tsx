import { Suspense } from "react";
import type { Metadata } from "next";
import ConnectionsPanel from "@/components/publish/connections-panel";

export const metadata: Metadata = {
  title: "Connections",
  description: "Connect your platform accounts so posting can go straight out.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
        Connections
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Connect an account once. Posting and your calendar live in the Poster.
      </p>
      <Suspense>
        <ConnectionsPanel />
      </Suspense>
    </div>
  );
}
