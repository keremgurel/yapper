import type { Metadata } from "next";
import StudioDashboard from "@/components/studio-home/studio-dashboard";

export const metadata: Metadata = {
  title: "Home",
  description: "Channel performance, top content, and daily content ideas.",
  robots: { index: false },
};

export default function StudioHomePage() {
  return <StudioDashboard />;
}
