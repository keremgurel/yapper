import type { Metadata } from "next";
import { StyleGuideClient } from "./style-guide-client";

export const metadata: Metadata = {
  title: "Style Guide",
  robots: { index: false, follow: false },
};

export default function StyleGuidePage() {
  return <StyleGuideClient />;
}
