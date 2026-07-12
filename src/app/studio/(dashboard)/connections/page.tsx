import { Suspense } from "react";
import type { Metadata } from "next";
import ConnectionsPanel from "@/components/publish/connections-panel";

export const metadata: Metadata = {
  title: "Connections",
  description: "Connect the platforms you cross-post to.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
        Connections
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Connect an account once, then cross-post to it from your library.
      </p>
      <Suspense>
        <ConnectionsPanel />
      </Suspense>
    </div>
  );
}
