import { Layers, Library, Scissors, Share2, Video } from "lucide-react";
import type { StudioIcon } from "@/data/studio-nav";

const map = {
  share: Share2,
  library: Library,
  layers: Layers,
  record: Video,
  scissors: Scissors,
} as const;

export default function StudioNavIcon({
  icon,
  className,
}: {
  icon: StudioIcon;
  className?: string;
}) {
  const Icon = map[icon];
  return <Icon className={className} />;
}
