import type { Metadata } from "next";
import BrandPanel from "@/components/studio/brand/brand-panel";

export const metadata: Metadata = {
  title: "Brand Kit",
  description: "Set the logos and colors Chirpy uses in generated visuals.",
};

export default function BrandPage() {
  return <BrandPanel />;
}
