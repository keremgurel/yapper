"use client";

import type { ContentSpec } from "@/lib/style-library/format/content-spec";
import type { OptionSpec } from "@/lib/style-library/format/option-spec";
import ChoiceControl from "./choice-control";
import ColorControl from "./color-control";
import NumberControl from "./number-control";
import TextControl from "./text-control";
import ToggleControl from "./toggle-control";

/** The right control for a setting's kind. Transcript and timing lists have none: the video supplies them. */
export default function SettingControl({
  spec,
  value,
  sample,
  onChange,
}: {
  spec: OptionSpec | ContentSpec;
  value: unknown;
  /** What the preview shows while this is empty, offered as the field's hint. */
  sample?: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (spec.kind) {
    case "number":
      return (
        <NumberControl spec={spec} value={Number(value)} onChange={onChange} />
      );
    case "enum":
      return (
        <ChoiceControl spec={spec} value={String(value)} onChange={onChange} />
      );
    case "color":
      return (
        <ColorControl spec={spec} value={String(value)} onChange={onChange} />
      );
    case "boolean":
      return (
        <ToggleControl spec={spec} value={Boolean(value)} onChange={onChange} />
      );
    case "text":
      return (
        <TextControl
          label={spec.label}
          help={spec.help}
          value={String(value ?? "")}
          maxLength={spec.maxLength}
          placeholder={typeof sample === "string" ? sample : undefined}
          onChange={onChange}
        />
      );
    case "media":
      return (
        <TextControl
          label={spec.label}
          help={spec.help}
          value={typeof value === "string" ? value : ""}
          placeholder={
            sample
              ? `Sample shown. Paste a link to ${spec.accepts.join(" or ")}`
              : `Link to ${spec.accepts.join(" or ")}`
          }
          onChange={(next) => onChange(next.trim() === "" ? null : next.trim())}
        />
      );
    default:
      return null;
  }
}
