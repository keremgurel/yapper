import { getBrandKit, saveBrandColors } from "./client";
import { applyBrandCommand, type BrandCommand } from "./command";
import {
  mutateClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";

export interface BrandCommandReply {
  text: string;
  notes?: string[];
  brandColors?: string[];
  tone?: "done" | "trouble";
}

/** Same persisted kit used by the Brand page and generated video visuals. */
export async function executeBrandCommand(
  command: BrandCommand,
): Promise<BrandCommandReply> {
  if (command.kind === "clarify") return { text: command.message };
  const current = await getBrandKit();
  const colors =
    command.kind === "update"
      ? applyBrandCommand(command, current.colors)
      : current.colors;
  const changed = colors.join() !== current.colors.join();
  const kit = changed ? await saveBrandColors(colors) : current;
  mutateClientResource(STUDIO_RESOURCE_KEYS.brand, kit);
  return {
    text: changed
      ? kit.colors.length
        ? "Saved your brand colors. Your kit is ready for new video graphics."
        : "Removed those colors from your brand kit."
      : kit.colors.length
        ? "Here’s your brand kit."
        : "Your brand kit has no colors yet. Tell me your colors and I’ll save them here.",
    notes: [
      ...(kit.colors.length ? [`Primary: ${kit.colors[0]}`] : []),
      `${kit.logos.length} saved logo${kit.logos.length === 1 ? "" : "s"}`,
    ],
    brandColors: kit.colors,
    ...(changed ? { tone: "done" as const } : {}),
  };
}
