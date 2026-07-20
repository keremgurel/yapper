import {
  CalendarDays,
  BookType,
  Layers,
  Library,
  Scissors,
  Send,
  Share2,
  Video,
} from "lucide-react";
import type { StudioIcon } from "@/data/studio-nav";

const map = {
  share: Share2,
  calendar: CalendarDays,
  library: Library,
  layers: Layers,
  record: Video,
  scissors: Scissors,
  send: Send,
  dictionary: BookType,
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
