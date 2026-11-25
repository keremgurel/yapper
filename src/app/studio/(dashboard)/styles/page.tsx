import type { Metadata } from "next";
import StylesGallery from "@/components/styles/gallery/styles-gallery";

export const metadata: Metadata = {
  title: "Styles",
  description:
    "Templates and blocks for talking-head videos, with a live preview.",
};

export default function StylesPage() {
  return <StylesGallery />;
}
