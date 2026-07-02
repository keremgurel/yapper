import { Layers, Library, Scissors, Video } from "lucide-react";
import type { StudioIcon } from "@/data/studio-nav";

const map = {
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
