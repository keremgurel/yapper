import {
  Brain,
  CalendarDays,
  BookType,
  Layers,
  Library,
  House,
  Scissors,
  Send,
  Share2,
  Video,
  Zap,
  HardDrive,
} from "lucide-react";
import type { StudioIcon } from "@/data/studio-nav";

const map = {
  home: House,
  share: Share2,
  calendar: CalendarDays,
  library: Library,
  layers: Layers,
  record: Video,
  scissors: Scissors,
  send: Send,
  dictionary: BookType,
  zap: Zap,
  brain: Brain,
  storage: HardDrive,
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
