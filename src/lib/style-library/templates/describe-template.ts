import type { ContentSpec } from "../format/content-spec";
import type { OptionSpec } from "../format/option-spec";
import { resolveContent, resolveOptions } from "../format/resolve-values";
import type { StyleBlock } from "../format/style-block";
import type { AnyStyleDefinition } from "../format/style-definition";
import { getStyle } from "../registry";
import { stylesFor } from "./edit-template";
import type { Template } from "./template";
import { listPlaces } from "./template-places";

/** One setting as a person or a model needs to see it to change it. */
export interface SettingDescription {
  key: string;
  label: string;
  kind: OptionSpec["kind"] | ContentSpec["kind"];
  value: unknown;
  /** Allowed values for an enum, `[min, max]` for a number. */
  allowed?: readonly (string | number)[];
  help?: string;
}

export interface PlaceDescription {
  path: string;
  label: string;
  /** Style ids that can go here. */
  canHold: string[];
  block: null | {
    styleId: string;
    name: string;
    options: SettingDescription[];
    content: SettingDescription[];
  };
}

export interface TemplateDescription {
  id: string;
  name: string;
  summary: string;
  places: PlaceDescription[];
}

const allowed = (spec: OptionSpec | ContentSpec) =>
  spec.kind === "enum"
    ? spec.choices.map((choice) => choice.value)
    : spec.kind === "number"
      ? [spec.min, spec.max]
      : undefined;

/** Lists are summarised: a transcript is long and comes from the project anyway. */
const shown = (value: unknown) =>
  Array.isArray(value)
    ? `${value.length} items, filled from the project`
    : value;

function settings(
  specs: Record<string, OptionSpec | ContentSpec>,
  values: Record<string, unknown>,
  visible: (spec: OptionSpec | ContentSpec) => boolean,
): SettingDescription[] {
  return Object.entries(specs)
    .filter(([, spec]) => visible(spec))
    .map(([key, spec]) => ({
      key,
      label: spec.label,
      kind: spec.kind,
      value: shown(values[key]),
      allowed: allowed(spec),
      help: "help" in spec ? spec.help : undefined,
    }));
}

function describeBlock(style: AnyStyleDefinition, block: StyleBlock) {
  const options = resolveOptions(style.options, block.options).values;
  const content = resolveContent(style.content, block.content).values;
  return {
    styleId: style.id,
    name: style.name,
    // Controls hidden by `showWhen` are left out, as they are in the inspector.
    options: settings(style.options, options, (spec) => {
      const when = "showWhen" in spec ? spec.showWhen : undefined;
      return !when || when.in.includes(String(options[when.option]));
    }),
    content: settings(style.content, content, () => true),
  };
}

/**
 * The template as a list of places with what is in each, what could go there,
 * and every setting with its current value and limits. Enough for a model to
 * write a correct edit without seeing the code.
 */
export function describeTemplate(template: Template): TemplateDescription {
  return {
    id: template.id,
    name: template.name,
    summary: template.summary,
    places: listPlaces(template).map((place) => {
      const style = place.block && getStyle(place.block.styleId);
      return {
        path: place.path,
        label: place.label,
        canHold: stylesFor(place),
        block: place.block && style ? describeBlock(style, place.block) : null,
      };
    }),
  };
}
