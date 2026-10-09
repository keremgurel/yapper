import type { Metadata } from "next";
import StudioDashboard from "@/components/studio-home/studio-dashboard";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Capture an idea, see what to work on next, and how your posts are doing.",
  robots: { index: false },
};

export default function StudioHomePage() {
  return <StudioDashboard />;
}
