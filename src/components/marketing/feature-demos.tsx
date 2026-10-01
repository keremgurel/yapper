"use client";

import { type ReactNode } from "react";
import { useDemoPlayback } from "./use-demo-playback";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import EditProgressPreview from "./edit-progress-preview";
import { ScriptFilm, RecordingFilm, PublishingFilm } from "./feature-scenes";
import DemoBackdrop from "./demo-backdrop";

function Demo({
  title,
  description,
  href,
  label,
  palette,
  frames = 6,
  children,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
  palette: "blue" | "peach";
  frames?: number;
  children: (frame: number, playing: boolean) => ReactNode;
}) {
  const { ref, frame, active } = useDemoPlayback(frames);
  return (
    <article className="feature-film">
      <div className="feature-film-stage" ref={ref}>
        <DemoBackdrop palette={palette} />
        <div className="feature-film-content" inert aria-hidden="true">
          {children(frame, active)}
        </div>
      </div>
      <div className="feature-film-copy">
        <h3>{title}</h3>
        <p>{description}</p>
        <Link href={href}>
          {label}
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  );
}

export default function FeatureDemos() {
  return (
    <div className="feature-films">
      <Demo
        title="Find the words. Keep your voice."
        description="Turn a rough idea into a hook and a script you can actually say."
        href="/features/ai-script-writer"
        label="AI script writer"
        palette="blue"
        frames={7}
      >
        {(frame, playing) => <ScriptFilm frame={frame} playing={playing} />}
      </Demo>
      <Demo
        title="Look at the lens. Stay on track."
        description="Read your script on camera with a teleprompter that moves at your pace."
        href="/features/teleprompter-recorder"
        label="Teleprompter recorder"
        palette="peach"
      >
        {(frame, playing) => <RecordingFilm frame={frame} playing={playing} />}
      </Demo>
      <Demo
        title="Your timeline. Every cut in your hands."
        description="Edit the transcript, refine your timeline, and style captions. Let one-click editing make the first pass."
        href="/features/transcript-video-editor"
        label="Video editing"
        palette="peach"
      >
        {(frame, playing) => (
          <EditProgressPreview frame={frame} playing={playing} />
        )}
      </Demo>
      <Demo
        title="Make it ready for your audience."
        description="Write a caption for each destination and check the details before you publish."
        href="/features/social-publishing"
        label="Social publishing"
        palette="blue"
        frames={7}
      >
        {(frame) => <PublishingFilm frame={frame} />}
      </Demo>
    </div>
  );
}
