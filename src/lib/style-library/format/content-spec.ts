import type {
  EnumOption,
  MediaOption,
  NumberOption,
  OptionValue,
  TextOption,
} from "./option-spec";

/**
 * What a style is filled with each time it is used: the take, the words, a
 * title. Options are the taste and travel with a saved variant; content is the
 * video's own material and comes from the project.
 */

/** A transcript word in seconds from the start of the style, as on the wire. */
export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

/** A stretch of time in seconds from the start of the style. */
export interface TimeWindow {
  from: number;
  to: number;
}

export interface WordsContent {
  kind: "words";
  label: string;
}

export interface WindowsContent {
  kind: "windows";
  label: string;
}

export type ContentSpec =
  | TextOption
  | MediaOption
  | NumberOption
  | EnumOption
  | WordsContent
  | WindowsContent;

export type ContentSpecs = Record<string, ContentSpec>;

export type ContentValue<S> = S extends WordsContent
  ? TimedWord[]
  : S extends WindowsContent
    ? TimeWindow[]
    : OptionValue<S>;

export type ContentValues<S extends ContentSpecs> = {
  [K in keyof S]: ContentValue<S[K]>;
};

export const wordsContent = (label: string): WordsContent => ({
  kind: "words",
  label,
});

export const windowsContent = (label: string): WindowsContent => ({
  kind: "windows",
  label,
});
