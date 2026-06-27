import { Library, Lightbulb, Scissors, Video } from "lucide-react";
import type { CreateIcon as CreateIconKey } from "@/data/create-nav";

const map = {
  library: Library,
  lightbulb: Lightbulb,
  record: Video,
  scissors: Scissors,
} as const;

export default function CreateIcon({
  icon,
  className,
}: {
  icon: CreateIconKey;
  className?: string;
}) {
  const Icon = map[icon];
  return <Icon className={className} />;
}
