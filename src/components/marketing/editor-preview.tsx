"use client";

import Image from "next/image";
import { Scissors } from "lucide-react";
import EditProgressPreview from "./edit-progress-preview";
import { useDemoPlayback } from "./use-demo-playback";

const EDITOR_FRAME_MS = 1100;
/** How long one full pass of this demo takes. */
export const EDITOR_DEMO_MS = editorFrameCount * EDITOR_FRAME_MS;

import {
  editSegments,
  sourceDuration,
  editorFrameCount,
  formatDemoTime,
  getEditState,
} from "./editor-demo-sequence";

const footage = "/images/marketing/creator-studio.webp";

/** A browser rendering of the native editor's workbench, player and media timeline.
 * Sample footage and deterministic edits; never invokes the real editing APIs.
 */
export function EditorScene({
  frame,
  playing,
}: {
  frame: number;
  playing: boolean;
}) {
  const { clips, duration, playhead, split, captions, processing, stage } =
    getEditState(frame);
  return (
    <div
      className="editor-demo"
      data-frame={frame}
      data-playing={playing}
      role="img"
      aria-label="Video editor demonstration: a continuous take is split, three retakes and three pauses are deleted, clips close together, and captions are added. The editor includes a transcript, video preview, and multitrack timeline."
    >
      <div className="editor-demo-workspace" aria-hidden="true">
        <div className="editor-demo-transcript">
          <div className="editor-demo-pane-title">
            <span>Transcript</span>
          </div>
          <p className="editor-demo-words">
            {clips.map((segment) => (
              <span
                key={segment.start}
                className="editor-demo-phrase"
                data-deleted={segment.deleted}
                data-selected={segment.selected}
                data-pause={segment.kind === "pause"}
              >
                {segment.text}{" "}
              </span>
            ))}
          </p>
        </div>
        <div className="editor-demo-player">
          <div className="editor-demo-video">
            <Image
              src={footage}
              alt=""
              fill
              sizes="(max-width: 640px) 180px, 400px"
            />
            <div className="editor-demo-caption" data-visible={captions}>
              Start with
              <br />
              <span>what you have.</span>
            </div>
          </div>
          <div className="editor-demo-time">
            <span>
              {captions
                ? "01:24"
                : formatDemoTime(Math.floor((playhead / 100) * sourceDuration))}
            </span>
            <span>9:16</span>
          </div>
        </div>
        <div className="editor-demo-edit-overlay" data-visible={processing}>
          <EditProgressPreview frame={stage} playing={playing && processing} />
        </div>
      </div>
      <div className="editor-demo-timeline" aria-hidden="true">
        <div className="editor-demo-timeline-heading">
          <span>
            <Scissors size={13} /> Timeline
          </span>
          <span>
            {split ? clips.filter((clip) => !clip.deleted).length : 1}{" "}
            {split ? "clips" : "clip"} <i /> {formatDemoTime(duration)}
          </span>
        </div>
        <div className="editor-demo-ruler">
          <span>00:00</span>
          <span>00:30</span>
          <span>01:00</span>
          <span>01:30</span>
          <span>02:03</span>
        </div>
        <div className="editor-demo-tracks">
          <div className="editor-demo-video-track">
            {clips.map((segment, index) => {
              const { deleted, offset, selected } = segment;
              return (
                <div
                  key={segment.start}
                  className="editor-demo-clip"
                  data-split={split}
                  data-selected={selected}
                  data-deleted={deleted}
                  style={{
                    left: `${(offset / sourceDuration) * 100}%`,
                    width: `${(segment.duration / sourceDuration) * 100}%`,
                    opacity: deleted ? 0 : 1,
                    transform: deleted ? "translateY(12px) scaleY(.8)" : "none",
                  }}
                >
                  <div
                    className="editor-demo-thumbnails"
                    style={{ backgroundImage: `url(${footage})` }}
                  />
                  {(split || index === 0) && (
                    <span className="editor-demo-clip-name">
                      {split && segment.kind !== "keep"
                        ? segment.kind === "pause"
                          ? "Pause"
                          : "Retake"
                        : "Take 01"}
                    </span>
                  )}
                  <div className="editor-demo-waveform">
                    {Array.from({ length: 28 }, (_, n) => (
                      <i
                        key={n}
                        style={{
                          height: `${segment.kind === "pause" ? 8 + (n % 3) * 3 : 20 + ((n * 17 + index * 7) % 70)}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="editor-demo-caption-track"
            data-visible={captions}
            style={{ width: `${(duration / sourceDuration) * 100}%` }}
          >
            {editSegments
              .filter((segment) => segment.kind === "keep")
              .map((segment) => (
                <span key={segment.start} style={{ flex: segment.duration }}>
                  {segment.text}
                </span>
              ))}
          </div>
          <div
            className="editor-demo-playhead"
            style={{ left: `${playhead}%` }}
          >
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPreview() {
  const { ref, frame, active } = useDemoPlayback(
    editorFrameCount,
    EDITOR_FRAME_MS,
  );
  return (
    <div ref={ref}>
      <EditorScene frame={frame} playing={active} />
    </div>
  );
}
