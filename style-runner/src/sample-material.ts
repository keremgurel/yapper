import type { ProjectMaterial } from "../../src/lib/style-library/project-material";
import {
  SAMPLE_TAKE,
  SAMPLE_WORDS,
} from "../../src/lib/style-library/samples/sample-take";

/** The stand-in project every preview is drawn on. */
export const SAMPLE_MATERIAL: ProjectMaterial = {
  take: SAMPLE_TAKE,
  words: SAMPLE_WORDS,
};
