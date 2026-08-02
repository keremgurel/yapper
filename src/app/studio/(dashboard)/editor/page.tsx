import type { Metadata } from "next";

import DesktopEditorGate from "@/components/studio/desktop-editor-gate";

export const metadata: Metadata = {
  title: "Editor — Yapper Studio for Mac",
  description:
    "Open Yapper's native Mac editor for instant local media, seamless playback, transcript editing, and reliable export.",
  robots: { index: false },
};

export default function EditorPage() {
  return <DesktopEditorGate />;
}
