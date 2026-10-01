"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import { IdeaLibraryScene } from "./idea-library-preview";
import DemoDictation from "./demo-dictation";
import { spokenIdea } from "./demo-content";
import { useDemoPlayback } from "./use-demo-playback";

export default function IdeaPreview() {
  const { ref, frame, active } = useDemoPlayback(14, 1400);
  const saved = frame >= 7;
  const categorized = frame >= 6;
  const listening = frame >= 1 && frame <= 4;
  const words = spokenIdea.split(" ");
  const text =
    frame === 0
      ? ""
      : words.slice(0, Math.min(words.length, frame * 12)).join(" ");
  return (
    <div
      ref={ref}
      className="idea-demo"
      data-playing={active}
      data-saved={saved}
      role="img"
      aria-label="A spoken idea is transcribed, categorized as an original talking-head idea about creating content, and saved in the idea library."
    >
      <AnimatePresence initial={false}>
        {saved ? (
          <motion.div
            key="library"
            className="idea-demo-library"
            aria-hidden="true"
            initial={{ opacity: 0, y: 24, scale: 0.985, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10 }}
            transition={{
              duration: active ? 0.46 : 0,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <IdeaLibraryScene added />
          </motion.div>
        ) : (
          <motion.div
            key="capture"
            className="idea-demo-capture"
            aria-hidden="true"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18, scale: 0.96, filter: "blur(5px)" }}
            transition={{
              duration: active ? 0.32 : 0,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="idea-demo-capture-inner">
              <div className="idea-capture-heading">
                <ChirpyMark size={28} />
                <div>
                  <h2>A thought worth keeping.</h2>
                  <p>Say it out loud. Chirpy takes care of the details.</p>
                </div>
              </div>
              <DemoDictation
                text={text}
                active={active && listening}
                processing={active && frame === 5}
                saved={saved}
                frame={frame}
              />
              <div
                className="idea-demo-classification"
                data-visible={categorized}
              >
                <div className="idea-demo-chirpy">
                  <ChirpyMark size={24} />
                  <span>
                    {saved
                      ? "Filed where you’ll find it."
                      : "Here’s where this belongs."}
                  </span>
                </div>
                <dl className="idea-capture-fields">
                  <div>
                    <dt>Pillar</dt>
                    <dd>Creating content</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>Original</dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>Short-form</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>Captured</dd>
                  </div>
                </dl>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
