"use client";
import { Check } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
const editStages = [
  "Preparing your video",
  "Transcribing your audio",
  "Removing mistakes & retakes",
  "Cutting pauses",
  "Trimming silence",
  "Adding captions",
];
/** Mirrors the stage checklist in the native WorkbenchPanel. Sample state only. */
export default function EditProgressPreview({
  frame,
  playing,
}: {
  frame: number;
  playing: boolean;
}) {
  return (
    <div className="feature-edit">
      <div className="feature-edit-heading">
        <ThinkingOrb
          state={frame === 5 ? "composing" : "working"}
          size={64}
          paused={!playing}
        />
        <div>
          <strong>Editing your video</strong>
          <span>One-click edit</span>
        </div>
      </div>
      <div className="feature-edit-stages">
        {editStages.map((stage, i) => (
          <div key={stage} data-current={frame === i}>
            <span>
              {i < frame ? (
                <Check size={14} />
              ) : i === frame ? (
                <ThinkingOrb state="working" size={20} paused={!playing} />
              ) : (
                <span className="feature-stage-dot" />
              )}
            </span>
            {stage}
          </div>
        ))}
      </div>
    </div>
  );
}
