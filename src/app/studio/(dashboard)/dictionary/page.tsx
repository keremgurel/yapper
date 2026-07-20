import type { Metadata } from "next";
import DictionaryPanel from "@/components/studio/dictionary/dictionary-panel";

export const metadata: Metadata = {
  title: "Transcription Dictionary",
  description: "Teach Yapper the names, brands, and vocabulary you use.",
  robots: { index: false },
};

export default function Page() {
  return <DictionaryPanel />;
}
