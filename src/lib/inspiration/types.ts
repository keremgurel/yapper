export type Platform = "youtube" | "tiktok" | "instagram" | "unknown";

export interface Pillar {
  id: string;
  name: string;
  createdAt: number;
}

export interface InspirationItem {
  id: string;
  /** null = not yet sorted into a pillar */
  pillarId: string | null;
  url: string;
  platform: Platform;
  title: string;
  author?: string;
  thumbnail?: string;
  transcript?: string;
  note?: string;
  createdAt: number;
}

export interface ResolvedLink {
  platform: Platform;
  title: string;
  author?: string;
  thumbnail?: string;
  transcript?: string;
}
