"use client";

import { useId, useState } from "react";
import StudioTabs from "./studio-tabs";
import PublisherPreview from "./publisher-preview";
import EditorPreview from "./editor-preview";
import IdeaPreview from "./idea-preview";
import WritingPreview from "./writing-preview";
import TeleprompterPreview from "./teleprompter-preview";

export type PreviewStep = "Idea" | "Script" | "Record" | "Edit" | "Publish";
/** Shipped Studio components, with isolated sample state. No account or media APIs. */
export default function StudioPreview({
  initialStep = "Script",
}: {
  initialStep?: PreviewStep;
}) {
  const id = useId();
  const [step, setStep] = useState<PreviewStep>(initialStep);
  return (
    <figure className="studio-showcase">
      <StudioTabs
        value={step}
        onChange={setStep}
        panelId={`${id}-panel`}
        id={id}
      />
      <div className="demo-field">
        <div
          className="studio-showcase-screen"
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-${step}`}
        >
          <div className="studio-screen-heading">
            <span>
              yapper <span>studio</span>
            </span>
          </div>
          {step === "Idea" ? (
            <IdeaPreview />
          ) : step === "Script" ? (
            <WritingPreview />
          ) : step === "Record" ? (
            <TeleprompterPreview />
          ) : step === "Edit" ? (
            <EditorPreview />
          ) : (
            <PublisherPreview />
          )}
        </div>
      </div>
    </figure>
  );
}
