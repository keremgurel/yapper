"use client";

import EditorPreview from "../editor-preview";
import IdeaPreview from "../idea-preview";
import PublisherPreview from "../publisher-preview";
import TeleprompterPreview from "../teleprompter-preview";
import WritingPreview from "../writing-preview";
import { useDemoPlayback } from "../use-demo-playback";
import WalkthroughSteps from "./walkthrough-steps";
import styles from "./product-showcase.module.css";

const STEPS = ["Ideas", "Script", "Record", "Edit", "Publish"] as const;
const SCENES = [
  IdeaPreview,
  WritingPreview,
  TeleprompterPreview,
  EditorPreview,
  PublisherPreview,
];
const SCENE_MS = 7000;

/** One film of the whole Studio workflow. It plays through the five stages on
 * its own while on screen, using the same scenes as the Studio page. */
export default function StudioWalkthrough() {
  const { ref, frame, seek } = useDemoPlayback(STEPS.length, SCENE_MS);
  const Scene = SCENES[frame];
  return (
    <div ref={ref} className={styles.walkthrough}>
      <div className={`studio-showcase ${styles.studioFrame}`}>
        <div className="studio-showcase-screen">
          <div className="studio-screen-heading">
            <span>
              yapper <span>studio</span>
            </span>
            <WalkthroughSteps
              steps={STEPS}
              current={frame}
              onSelect={seek}
              label="Studio workflow"
            />
          </div>
          {/* Keyed so each stage starts its own sequence from the beginning. */}
          <div key={frame} inert aria-hidden="true">
            <Scene />
          </div>
        </div>
      </div>
    </div>
  );
}
