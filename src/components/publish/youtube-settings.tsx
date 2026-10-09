"use client";

import { useId } from "react";

export interface YouTubeSettings {
  privacyStatus: "private" | "unlisted" | "public";
  selfDeclaredMadeForKids: boolean | null;
  containsSyntheticMedia: boolean;
}

export const INITIAL_YOUTUBE_SETTINGS: YouTubeSettings = {
  privacyStatus: "private",
  selfDeclaredMadeForKids: null,
  containsSyntheticMedia: false,
};

export default function YouTubeSettingsFields({
  value,
  onChange,
  disabled,
}: {
  value: YouTubeSettings;
  onChange: (value: YouTubeSettings) => void;
  disabled: boolean;
}) {
  const id = useId();
  const fieldClass =
    "border-border bg-card min-h-11 rounded-lg border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="mb-3 text-sm font-semibold">YouTube settings</legend>
      <label className="flex flex-col gap-2" htmlFor={`${id}-visibility`}>
        <span className="text-sm">Visibility</span>
        <select
          id={`${id}-visibility`}
          className={fieldClass}
          value={value.privacyStatus}
          onChange={(event) =>
            onChange({
              ...value,
              privacyStatus: event.target
                .value as YouTubeSettings["privacyStatus"],
            })
          }
        >
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
      </label>
      <label className="flex flex-col gap-2" htmlFor={`${id}-audience`}>
        <span className="text-sm">Is this content made for kids?</span>
        <select
          id={`${id}-audience`}
          className={fieldClass}
          required
          value={
            value.selfDeclaredMadeForKids === null
              ? ""
              : String(value.selfDeclaredMadeForKids)
          }
          onChange={(event) =>
            onChange({
              ...value,
              selfDeclaredMadeForKids:
                event.target.value === ""
                  ? null
                  : event.target.value === "true",
            })
          }
        >
          <option value="">Choose an audience</option>
          <option value="false">No, it’s not made for kids</option>
          <option value="true">Yes, it’s made for kids</option>
        </select>
      </label>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={value.containsSyntheticMedia}
          onChange={(event) =>
            onChange({ ...value, containsSyntheticMedia: event.target.checked })
          }
        />
        <span>This content includes realistic altered or synthetic media.</span>
      </label>
      <p className="text-muted-foreground text-xs">
        These settings apply to every YouTube video in this selection, including
        scheduled uploads. Processing may continue after upload.
      </p>
    </fieldset>
  );
}
