import type { Metadata } from "next";
import CanvasWorkbench from "@/components/canvas/canvas-workbench";

export const metadata: Metadata = {
  title: "Canvas",
  robots: { index: false }, // personal dashboard surface
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CanvasWorkbench key={id} id={id} />;
}
