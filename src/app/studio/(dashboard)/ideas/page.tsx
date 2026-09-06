import type { Metadata } from "next";
import IdeasPage from "@/components/ideas/ideas-page";

export const metadata: Metadata = {
  title: "Ideas · Yapper Studio",
};

export default function IdeasRoute() {
  return <IdeasPage />;
}
