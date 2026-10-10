"use client";

import { FileText, Lightbulb, Send, Video, Scissors } from "lucide-react";
import GlassTabs from "@/components/studio-ui/glass-tabs";
import type { PreviewStep } from "./studio-preview";

const tabs = [
  { value: "Idea", label: "Ideas", Icon: Lightbulb },
  { value: "Script", label: "Script", Icon: FileText },
  { value: "Record", label: "Record", Icon: Video },
  { value: "Edit", label: "Edit", Icon: Scissors },
  { value: "Publish", label: "Publish", Icon: Send },
] as const;

/** The five Studio stages in the glass capsule. */
export default function StudioTabs({
  value,
  onChange,
  panelId,
  id,
}: {
  value: PreviewStep;
  onChange: (value: PreviewStep) => void;
  panelId: string;
  id: string;
}) {
  return (
    <GlassTabs
      tabs={tabs}
      value={value}
      onChange={onChange}
      panelId={panelId}
      id={id}
      label="Explore Studio"
    />
  );
}
