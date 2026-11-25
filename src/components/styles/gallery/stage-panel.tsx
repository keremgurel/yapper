"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ProjectMaterial } from "@/lib/style-library/project-material";
import {
  SAMPLE_TAKE,
  SAMPLE_WORDS,
} from "@/lib/style-library/samples/sample-take";
import type { Template } from "@/lib/style-library/templates/template";
import { TemplateView } from "@/lib/style-library/templates/TemplateView";
import StyleStage from "../stage/style-stage";
import { useLoopClock } from "../stage/use-loop-clock";

/** The stand-in video every look is previewed on until a creator's own take can be picked. */
const SAMPLE: ProjectMaterial = { take: SAMPLE_TAKE, words: SAMPLE_WORDS };

const prefersStill = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The live preview: the open template playing on the sample take, sized to fit the window. */
export default function StagePanel({
  template,
  durationS,
  notice,
}: {
  template: Template;
  durationS: number;
  notice: string | null;
}) {
  const [playing, setPlaying] = useState(() => !prefersStill());
  const time = useLoopClock(durationS, playing);
  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: "min(100%, calc((100svh - 12rem) * 9 / 16))" }}
    >
      <StyleStage time={time} durationS={durationS}>
        <TemplateView template={template} material={SAMPLE} samples />
      </StyleStage>
      <div className="mt-2 flex min-h-9 items-center gap-2">
        {durationS > 0 && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={playing ? "Pause preview" : "Play preview"}
            onClick={() => setPlaying((now) => !now)}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
        )}
        <p aria-live="polite" className="text-muted-foreground min-w-0 text-xs">
          {notice ?? "Preview on a sample take. The sound is off."}
        </p>
      </div>
    </div>
  );
}
