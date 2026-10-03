"use client";

import VoiceSurface from "@/components/common/voice-surface";
import { useDemoPlayback } from "../use-demo-playback";
import {
  ChooseScene,
  FeedbackScene,
  PromptScene,
  SpeakScene,
} from "./train-scenes";
import WalkthroughSteps from "./walkthrough-steps";
import styles from "./product-showcase.module.css";

const STEPS = ["Choose", "Prompt", "Speak", "Feedback"] as const;
const SCENES = [ChooseScene, PromptScene, SpeakScene, FeedbackScene];
const SCENE_MS = 4200;
const SPEAK = 2;

/** A voice-like level: a slow swell with a faster flutter on top. */
function speakingLevel() {
  const t = performance.now();
  return (
    0.3 + Math.abs(Math.sin(t / 340)) * 0.3 + Math.abs(Math.sin(t / 90)) * 0.12
  );
}

/** One film of a full practice session: pick an exercise, read the prompt,
 * speak, get feedback. Sample content, no microphone. */
export default function TrainWalkthrough() {
  const { ref, frame, seek, active } = useDemoPlayback(STEPS.length, SCENE_MS);
  const Scene = SCENES[frame];
  return (
    <div ref={ref} className={styles.walkthrough}>
      <div className="demo-field">
        <div className={styles.trainWindow}>
          <div className={styles.trainHeading}>
            <span>
              <strong>yapper</strong> train
            </span>
            <WalkthroughSteps
              steps={STEPS}
              current={frame}
              onSelect={seek}
              label="A practice session"
            />
          </div>
          {/* The Voice glow rises from the bottom edge while "speaking". */}
          <VoiceSurface
            active={active && frame === SPEAK}
            level={speakingLevel}
            theme="light"
            className={styles.trainStage}
          >
            {/* Keyed so each scene's entrance and ring start from zero. */}
            <div key={frame} className={styles.trainScene} aria-hidden="true">
              <Scene />
            </div>
          </VoiceSurface>
        </div>
      </div>
    </div>
  );
}
