import { zColor } from "@remotion/zod-types";
import { z } from "zod";
import type {
  OptionSpec,
  OptionSpecs,
} from "../../src/lib/style-library/format/option-spec";

function zodFor(spec: OptionSpec): z.ZodType {
  switch (spec.kind) {
    case "number":
      return z.number().min(spec.min).max(spec.max);
    case "enum":
      return z.enum(
        spec.choices.map((choice) => choice.value) as [string, ...string[]],
      );
    case "color":
      return zColor();
    case "boolean":
      return z.boolean();
    case "text":
      return z.string().max(spec.maxLength);
    case "media":
      return z.string().nullable();
  }
}

/**
 * A style's options as a zod object, which is what gives Remotion Studio its
 * live controls. Every key is optional: a caller may send only what it changes.
 */
export const zodFromSpecs = (specs: OptionSpecs) =>
  z
    .object(
      Object.fromEntries(
        Object.entries(specs).map(([key, spec]) => [key, zodFor(spec)]),
      ),
    )
    .partial();
