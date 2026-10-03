"use client";

import EditorPreview, { EDITOR_DEMO_MS } from "../editor-preview";
import IdeaPreview, { IDEA_DEMO_MS } from "../idea-preview";
import PublisherPreview, { PUBLISH_DEMO_MS } from "../publisher-preview";
import TeleprompterPreview from "../teleprompter-preview";
import WritingPreview, { WRITING_DEMO_MS } from "../writing-preview";
import { demoHook, demoScript } from "../demo-content";
import { useDemoPlayback } from "../use-demo-playback";
import { DEFAULT_WPM } from "@/hooks/use-teleprompter-scroll";
import WalkthroughSteps from "./walkthrough-steps";
import { useStageClock } from "./use-stage-clock";
import styles from "./product-showcase.module.css";

const STEPS = ["Ideas", "Script", "Record", "Edit", "Publish"] as const;
const SCENES = [
  IdeaPreview,
  WritingPreview,
  TeleprompterPreview,
  EditorPreview,
  PublisherPreview,
];

/** The teleprompter scrolls the sample script at the default reading pace.
 * The opening lines start on screen, so the scroll ends about a quarter
 * sooner than reading every word would take. */
const RECORD_DEMO_MS = Math.round(
  (`${demoHook} ${demoScript}`.split(/\s+/).length / DEFAULT_WPM) *
    60_000 *
    0.75,
);
const DURATIONS = [
  IDEA_DEMO_MS,
  WRITING_DEMO_MS,
  RECORD_DEMO_MS,
  EDITOR_DEMO_MS,
  PUBLISH_DEMO_MS,
] as const;

/** One film of the whole Studio workflow, using the same scenes as the Studio
 * page. Each stage stays on screen until its own demo has played through. */
export default function StudioWalkthrough() {
  const { ref, active } = useDemoPlayback(1);
  const { stage, pass, select } = useStageClock(DURATIONS, active);
  const Scene = SCENES[stage];
  return (
    <div ref={ref} className={styles.walkthrough}>
      <div className="demo-field">
        <div className={`studio-showcase ${styles.studioFrame}`}>
          <div className="studio-showcase-screen">
            <div className="studio-screen-heading">
              <span>
                yapper <span>studio</span>
              </span>
              <WalkthroughSteps
                steps={STEPS}
                current={stage}
                onSelect={select}
                label="Studio workflow"
              />
            </div>
            {/* Keyed so each stage starts its own sequence from the beginning. */}
            <div key={`${stage}-${pass}`} inert aria-hidden="true">
              <Scene />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
