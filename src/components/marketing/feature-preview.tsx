import backdrops from "./grainient-background.module.css";
import IdeaPreview from "./idea-preview";
import WritingPreview from "./writing-preview";
import TeleprompterPreview from "./teleprompter-preview";
import EditorPreview from "./editor-preview";
import PublisherPreview from "./publisher-preview";
import LibraryPreview from "./idea-library-preview";
import CalendarPreview from "./calendar-preview";
import CaptionsPreview from "./captions-preview";

const previews = {
  "idea-capture": IdeaPreview,
  "ai-script-writer": WritingPreview,
  "teleprompter-recorder": TeleprompterPreview,
  "transcript-video-editor": EditorPreview,
  "social-publishing": PublisherPreview,
  "content-library": LibraryPreview,
  "content-calendar": CalendarPreview,
  "automatic-captions": CaptionsPreview,
};

/** The stage backdrop each feature is shown on, wherever it appears. */
export const featurePalettes: Record<string, string> = {
  "idea-capture": "ideas",
  "ai-script-writer": "script",
  "teleprompter-recorder": "record",
  "transcript-video-editor": "edit",
  "social-publishing": "publish",
  "content-library": "script",
  "content-calendar": "ideas",
  "automatic-captions": "record",
};

export default function FeaturePreview({ slug }: { slug: string }) {
  const Preview = previews[slug as keyof typeof previews];
  if (!Preview) return null;
  return (
    <div
      className={`feature-focused-preview ${backdrops.background} ${backdrops.wide}`}
      data-palette={featurePalettes[slug]}
    >
      <div className="studio-showcase-screen">
        <Preview />
      </div>
    </div>
  );
}
