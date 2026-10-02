import {
  dimensionAverages,
  type DimensionWindowAverage,
} from "@/lib/progress/dimension-averages";
import {
  SKILLS,
  type Skill,
  type SkillScores,
} from "@/lib/training-feedback/skills";

/**
 * Latest-window average and movement for each skill. `records` is
 * chronological, oldest first. A skill is averaged only over the sessions that
 * measured it, so sessions without an audio assessment do not drag Expressive
 * to zero.
 */
export function skillWindowAverages(
  records: readonly SkillScores[],
): Record<Skill, DimensionWindowAverage> {
  const result = {} as Record<Skill, DimensionWindowAverage>;
  for (const skill of SKILLS) {
    const measured = records.flatMap((record) => {
      const value = record[skill];
      return value === null ? [] : [{ value }];
    });
    result[skill] = dimensionAverages(measured, ["value"]).value;
  }
  return result;
}
