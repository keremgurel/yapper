import type { Metadata } from "next";
import IdeaBank from "@/components/ideas/idea-bank";

export const metadata: Metadata = {
  title: "Idea bank — Yapper Studio",
};

export default function IdeasPage() {
  return <IdeaBank />;
}
