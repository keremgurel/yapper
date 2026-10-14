import { VERSION_FORMATS, type VersionFormat } from "@/lib/content/formats";

/** Whether a skill shapes this format's writing. No formats means all of them. */
export function skillApplies(
  formats: readonly VersionFormat[] | undefined,
  format: VersionFormat,
): boolean {
  return !formats?.length || formats.includes(format);
}

/** A skill's formats with one switched on or off, kept in tab order. */
export function toggleSkillFormat(
  formats: readonly VersionFormat[] | undefined,
  format: VersionFormat,
): VersionFormat[] {
  const current = formats ?? [];
  const next = current.includes(format)
    ? current.filter((value) => value !== format)
    : [...current, format];
  return VERSION_FORMATS.filter((value) => next.includes(value));
}
