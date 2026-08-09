import type { Metadata } from "next";
import BrainPage from "@/components/brain/brain-page";

export const metadata: Metadata = {
  title: "Brain",
  description:
    "What you make, who it is for, and why. The standing context every AI call in Studio reads.",
  robots: { index: false },
};

export default function Page() {
  return <BrainPage />;
}
