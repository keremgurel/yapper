"use client";

import { useRouter } from "next/navigation";
import { Download, RotateCcw, Scissors } from "lucide-react";
import { setPendingVideo } from "@/lib/studio/handoff";

/** After a take: play it back, then retake, edit in the studio, or download.
 * "Edit this take" hands the blob to /studio via the in-memory handoff (the
 * same path the practice flow uses), so the recording flows straight into the
 * transcript editor + AI feedback. */
export default function RecorderReview({
  url,
  blob,
  onRetake,
}: {
  url: string;
  blob: Blob;
  onRetake: () => void;
}) {
  const router = useRouter();

  const edit = () => {
    setPendingVideo(blob);
    router.push("/studio");
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `yapper-take-${new Date().toISOString().slice(0, 19)}.webm`;
    a.click();
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <video
        src={url}
        controls
        playsInline
        className="mb-5 w-full rounded-2xl bg-black"
      />
      <div className="space-y-2">
        <button
          type="button"
          onClick={edit}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-cyan-600"
        >
          <Scissors className="h-4 w-4" />
          Edit this take
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRetake}
            className="border-border hover:bg-muted/40 flex flex-1 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Retake
          </button>
          <button
            type="button"
            onClick={download}
            className="border-border hover:bg-muted/40 flex flex-1 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
