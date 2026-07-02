import type { Metadata } from "next";
import ContentWorkbench from "@/components/library/content-workbench";

export const metadata: Metadata = {
  title: "Script Workbench",
  robots: { index: false }, // personal dashboard surface
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContentWorkbench id={id} />;
}
