import type { Metadata } from "next";
import CreateHub from "@/components/create/create-hub";

export const metadata: Metadata = {
  title: "Create: Inspiration to Finished Take",
  description:
    "Yapper's free creation flow: collect inspiration, shape an idea, record your take, and edit by editing the transcript. Local-first, no sign-up.",
  alternates: { canonical: "https://ypr.app/create" },
};

export default function Page() {
  return <CreateHub />;
}
