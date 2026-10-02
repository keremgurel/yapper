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

export default function FeaturePreview({ slug }: { slug: string }) {
  const Preview = previews[slug as keyof typeof previews];
  if (!Preview) return null;
  return (
    <div className="feature-focused-preview">
      <div className="studio-showcase-screen">
        <Preview />
      </div>
    </div>
  );
}
