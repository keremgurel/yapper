/**
 * Shared Studio primitives. The contract is docs/studio-design-language.md;
 * surfaces import from here instead of inventing per-page variants.
 *
 * Section and RailRow are re-exported from the workbench, which is the
 * reference implementation of the design language, so every surface uses the
 * same section headers and rail rows without duplicating them.
 */
export { default as Chip } from "@/components/studio-ui/chip";
export { CHIP_TONES, type ChipTone } from "@/components/studio-ui/chip-tones";
export { statusTone } from "@/components/studio-ui/status-tone";
export { formatTone } from "@/components/studio-ui/format-tone";
export { pillarTone } from "@/components/studio-ui/pillar-tone";
export { default as StatBlock } from "@/components/studio-ui/stat-block";
export { default as EmptyState } from "@/components/studio-ui/empty-state";
export { default as PageHeader } from "@/components/studio-ui/page-header";
export { default as Toolbar } from "@/components/studio-ui/toolbar";
export { default as Section } from "@/components/workbench/section";
export { default as RailRow } from "@/components/workbench/rail-row";
