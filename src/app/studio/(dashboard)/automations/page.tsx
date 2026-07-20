import type { Metadata } from "next";
import AutomationsView from "@/components/automations/automations-view";

export const metadata: Metadata = {
  title: "Automations",
  description:
    "Post once and let Yapper cross-post it to your other platforms.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
        Automations
      </h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        Post once and let Yapper repurpose it everywhere. Set an automation up
        and your posts cross-post themselves.
      </p>
      <AutomationsView />
    </div>
  );
}
