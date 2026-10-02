"use client";

import { useEffect, useRef } from "react";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  Mic,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { MeshGradient } from "@paper-design/shaders-react";
import { usePracticeSession } from "@/contexts/practice-session";
import topics, { CATEGORIES, DIFFICULTIES } from "@/data/topics";
import { getTrainingMode } from "@/data/training-modes";
import { TIMER_MAX_SECONDS, TIMER_MIN_SECONDS } from "@/lib/practice-helpers";
import RotaryKnob from "@/components/RotaryKnob";
import SlotLever from "@/components/SlotLever";
import VoiceSurface from "@/components/common/voice-surface";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { Button } from "@/components/ui/button";
import { GlassyButton } from "@/components/ui/glassy-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useDemoPlayback } from "@/components/marketing/use-demo-playback";
import ResearchPreparation from "@/components/training/research-preparation";
import MicStatus from "@/components/training/console/mic-status";
import SessionReview from "@/components/training/console/session-review";
import { useAutoMicrophone } from "@/hooks/use-auto-microphone";
import { MIC_REQUIRED_MESSAGE } from "@/hooks/use-media-stream";
import styles from "@/components/training/training-workspace.module.css";

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Filter({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={styles.filterButton}
          disabled={disabled}
          aria-label={`${label}: ${value}`}
        >
          {value === "All" ? `All ${label.toLowerCase()}` : value}
          <ChevronDown size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={styles.filterMenu}
        align="start"
        sideOffset={8}
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {["All", ...options].map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {option === "All" ? `All ${label.toLowerCase()}` : option}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function PracticeStage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const s = usePracticeSession();
  const config = getTrainingMode(s.drillSlug);
  const { videoRef, cameraOn, timerDone, getStream } = s;
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const voiceLevel = useAudioLevel(s.getStream, s.micOn, null);
  useAutoMicrophone(s.micOn, s.toggleMic);
  // A refused microphone is not an error to announce. The toolbar offers a
  // way to turn it on, and practice works without it.
  const mediaError =
    s.mediaError === MIC_REQUIRED_MESSAGE ? null : s.mediaError;
  const { ref: fieldRef, active: animateField } = useDemoPlayback(1);
  const isFreestyle = s.mode === "freestyle";
  const isRecall = config?.kind === "recall";
  const isResearch = config?.kind === "research";
  const isPassage = isRecall || config?.kind === "reading";
  const prompt = s.customPromptText ?? s.topic.text;
  const pool = config?.pool ?? topics;
  const levels = DIFFICULTIES.filter((level) =>
    pool.some(
      (topic) =>
        topic.difficulty === level &&
        (s.category === "All" || topic.category === s.category),
    ),
  );
  const ready = isFreestyle || s.hasGeneratedTopic;
  const locked = s.inSession || s.spinning;

  useEffect(() => {
    const video = videoRef.current;
    if (cameraOn && video && !timerDone) {
      video.srcObject = getStream();
      void video.play().catch(() => {});
    }
  }, [timerDone, cameraOn, getStream, videoRef]);
  useEffect(() => {
    if (s.promptEditorOpen) promptInput.current?.focus();
  }, [s.promptEditorOpen]);

  return (
    <section
      id="practice"
      aria-label="Speaking practice workspace"
      className={`${embedded ? "" : "marketing-container"} ${styles.workspace}`}
    >
      {mediaError && (
        <div className={styles.error} role="alert">
          <p>{mediaError}</p>
          <Button variant="ghost" size="sm" onClick={s.clearMediaError}>
            Dismiss
          </Button>
        </div>
      )}
      {s.timerDone ? (
        <SessionReview
          recordedUrl={s.recordedUrl}
          isVideo={s.cameraOn}
          recorded={s.cameraOn || s.micOn}
          audio={s.coachAudioBlob}
          audioPending={s.coachAudioPending}
          context={{
            drillSlug: s.drillSlug,
            drillTitle: s.drillTitle,
            prompt: isFreestyle
              ? (s.customPromptText ?? "Freestyle session")
              : prompt,
            targetSeconds: s.timerSeconds,
            goals: [],
          }}
          onDownload={s.downloadRecording}
          preparingDownload={s.isPreparingDownload}
          onRetry={s.resetTimer}
          onNewPrompt={() => {
            s.resetTimer();
            if (!isFreestyle) s.generateTopic();
          }}
        />
      ) : (
        <>
          <div
            className={`${styles.consoleGrid} ${s.cameraOn ? styles.withCamera : ""}`}
          >
            <div className={styles.console}>
              <div className={styles.toolbar}>
                <div className={styles.filters}>
                  {!isFreestyle && (
                    <>
                      {!s.hasPool && (
                        <Filter
                          label="Categories"
                          value={s.category}
                          options={[...CATEGORIES]}
                          onChange={s.handleCategoryChange}
                          disabled={locked}
                        />
                      )}
                      <Filter
                        label="Levels"
                        value={s.difficulty}
                        options={levels}
                        onChange={s.handleDifficultyChange}
                        disabled={locked}
                      />
                    </>
                  )}
                  {isFreestyle && <span>Your focus</span>}
                </div>
                <div className={styles.toolbarEnd}>
                  <MicStatus
                    on={s.micOn}
                    recording={s.inSession && !s.isPaused}
                    disabled={s.inSession}
                    onEnable={() => void s.toggleMic()}
                  />
                  <button
                    className={styles.editButton}
                    aria-label={
                      s.cameraOn ? "Turn camera off" : "Turn camera on"
                    }
                    aria-pressed={s.cameraOn}
                    onClick={() => void s.toggleCamera()}
                    disabled={s.inSession}
                  >
                    <Camera size={15} />
                  </button>
                  <button
                    className={styles.editButton}
                    aria-label={isFreestyle ? "Set a focus" : "Your own prompt"}
                    onClick={s.openPromptEditor}
                    disabled={locked}
                  >
                    <Pencil size={14} />
                    <span>
                      {isFreestyle ? "Set a focus" : "Your own prompt"}
                    </span>
                  </button>
                </div>
              </div>
              {s.promptEditorOpen ? (
                <div className={styles.promptEditor}>
                  <label htmlFor="practice-prompt">
                    {isFreestyle
                      ? "What do you want to talk about?"
                      : "Your prompt"}
                  </label>
                  <textarea
                    id="practice-prompt"
                    ref={promptInput}
                    value={s.promptDraft}
                    onChange={(event) => s.setPromptDraft(event.target.value)}
                    maxLength={5000}
                  />
                  <div>
                    <Button size="sm" onClick={s.savePromptDraft}>
                      Use prompt
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={s.cancelPromptDraft}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <VoiceSurface
                  level={voiceLevel}
                  active={s.micOn && !s.isPaused}
                  className={styles.promptVoice}
                >
                  <div
                    className={`${styles.reelWindow} ${isPassage ? styles.passage : ""}`}
                    aria-busy={s.spinning}
                  >
                    {s.spinning ? (
                      <div className={styles.reelTrack} aria-hidden="true">
                        {s.reelBlurbs.map((text, i) => (
                          <div className={styles.reelRow} key={i}>
                            <p className={styles.reelText}>{text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.reelRow} aria-live="polite">
                        <p className={styles.reelText}>
                          {isRecall && s.inSession
                            ? "Explain it in your own words."
                            : ready
                              ? isFreestyle
                                ? (s.customPromptText ??
                                  "Follow a thought. See where it takes you.")
                                : prompt
                              : "A little surprise. A minute to speak."}
                        </p>
                        {!ready && (
                          <p>Pull the lever to find your next topic.</p>
                        )}
                        {isRecall && s.inSession && (
                          <p>
                            The passage is hidden. Share the main idea and one
                            detail you remember.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </VoiceSurface>
              )}
              <div className={styles.practiceCue}>
                <p>
                  {config?.instruction ??
                    "Make a point, give an example, and bring it back to your point."}
                </p>
              </div>
              <div ref={fieldRef} className={styles.controlDock}>
                <div className={styles.mesh} aria-hidden="true">
                  <MeshGradient
                    style={{ width: "100%", height: "100%" }}
                    colors={["#09252f", "#226f7a", "#62776e", "#0c3441"]}
                    speed={animateField ? 0.25 : 0}
                  />
                </div>
                <div className={styles.leverControl}>
                  {!isFreestyle ? (
                    <>
                      <SlotLever
                        compact
                        onPull={s.generateTopic}
                        disabled={locked}
                      />
                      <button
                        className={styles.dockLink}
                        onClick={s.generateTopic}
                        disabled={locked}
                      >
                        {s.spinning ? "Rolling…" : "Generate"}
                        <RotateCcw size={13} />
                      </button>
                    </>
                  ) : (
                    <div className={styles.freestyleMark}>
                      <Mic size={28} />
                      <span>
                        No script.
                        <br />
                        Just you.
                      </span>
                    </div>
                  )}
                </div>
                <div className={styles.timerControl}>
                  <RotaryKnob
                    compact
                    value={s.inSession ? s.timeLeft : s.timerSeconds}
                    onChange={s.handleKnobChange}
                    min={s.inSession ? 0 : TIMER_MIN_SECONDS}
                    max={s.inSession ? s.timerSeconds : TIMER_MAX_SECONDS}
                    disabled={s.inSession}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={styles.dockLink}
                        disabled={s.inSession}
                        aria-label={`Duration: ${clock(s.timerSeconds)}`}
                      >
                        {s.inSession ? "Timer" : clock(s.timerSeconds)}
                        {!s.inSession && <ChevronDown size={13} />}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={styles.filterMenu}>
                      <DropdownMenuRadioGroup
                        value={String(s.timerSeconds)}
                        onValueChange={(value) =>
                          s.handleKnobChange(Number(value))
                        }
                      >
                        {[30, 60, 90, 120, 180, 300, 600].map((seconds) => (
                          <DropdownMenuRadioItem
                            key={seconds}
                            value={String(seconds)}
                          >
                            {clock(seconds)}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className={styles.startControl}>
                  {s.inSession ? (
                    <>
                      <span>{s.isPaused ? "Paused" : "Speaking time"}</span>
                      <strong
                        className={styles.countdown}
                        role="timer"
                        aria-label="Time remaining"
                      >
                        {clock(s.timeLeft)}
                      </strong>
                      <div className={styles.sessionButtons}>
                        <button
                          className={styles.dockLink}
                          onClick={s.pauseTimer}
                        >
                          {s.isPaused ? (
                            <Play size={15} />
                          ) : (
                            <Pause size={15} />
                          )}{" "}
                          {s.isPaused ? "Resume" : "Pause"}
                        </button>
                        <button
                          className={styles.dockLink}
                          onClick={s.finishTimer}
                        >
                          <Square size={13} />
                          Finish
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>
                        {isResearch
                          ? "Ready to explain?"
                          : "Your next rep starts here."}
                      </span>
                      <GlassyButton
                        disabled={!ready || s.spinning || s.promptEditorOpen}
                        onClick={s.startTimer}
                        height={44}
                      >
                        Start speaking
                        <ArrowRight size={15} />
                      </GlassyButton>
                      <p>
                        {s.cameraOn || s.micOn
                          ? "Your attempt will be recorded"
                          : "Practicing without a recording"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            {s.cameraOn && (
              <div className={styles.cameraPane}>
                <div className={styles.paneHeading}>
                  <span>Your camera</span>
                  {s.inSession && (
                    <span className={styles.recording}>
                      {s.isPaused ? "Paused" : "Recording"}
                    </span>
                  )}
                </div>
                <div className={styles.cameraView}>
                  <video ref={videoRef} autoPlay playsInline muted />
                  {s.micOn && (
                    <div className={styles.voice}>
                      <VoiceSurface
                        level={voiceLevel}
                        active={s.inSession && !s.isPaused}
                      >
                        {null}
                      </VoiceSurface>
                    </div>
                  )}
                </div>
                <p className={styles.cameraNote}>Keep the lens at eye level.</p>
              </div>
            )}
          </div>
          {isResearch && ready && !s.spinning && !s.inSession && (
            <ResearchPreparation key={prompt} question={prompt} />
          )}
        </>
      )}
    </section>
  );
}
