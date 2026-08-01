import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CalendarDays,
  Captions,
  Check,
  FileText,
  Lightbulb,
  Mic,
  Play,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type WorkflowStep = {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  accent: string;
  backdrop: string;
  visual:
    | "ideas"
    | "chirpy"
    | "script"
    | "record"
    | "edit"
    | "polish"
    | "publish";
};

const WORKFLOW: WorkflowStep[] = [
  {
    number: "01",
    eyebrow: "Collect",
    title: "Catch the spark before it disappears",
    description:
      "Drop a voice note, share a link, or type a thought. Add context only when it helps. Yapper keeps capture fast and turns raw inspiration into a developed content idea.",
    href: "/features/idea-capture",
    accent: "#ff8a2b",
    backdrop:
      "radial-gradient(circle at 14% 18%, #ffbd72 0, transparent 38%), radial-gradient(circle at 82% 78%, #14b8d4 0, transparent 42%), #203c47",
    visual: "ideas",
  },
  {
    number: "02",
    eyebrow: "Develop",
    title: "Turn raw inspiration into ideas worth making",
    description:
      "Chirpy expands each capture with angles, key points, and connections to your Idea Bank, past content, profile, and editable learnings.",
    href: "/features/idea-capture",
    accent: "#f5b91a",
    backdrop:
      "radial-gradient(circle at 72% 22%, #f59e0b 0, transparent 38%), radial-gradient(circle at 18% 82%, #7c3aed 0, transparent 43%), #271936",
    visual: "chirpy",
  },
  {
    number: "03",
    eyebrow: "Write",
    title: "Choose an idea and build the whole script",
    description:
      "Generate hook alternatives, key points, proven content formats, or a complete script. Keep it loose or refine every line in your own voice.",
    href: "/features/ai-script-writer",
    accent: "#f5b91a",
    backdrop:
      "radial-gradient(circle at 12% 16%, #fcd34d 0, transparent 34%), radial-gradient(circle at 88% 86%, #fb7185 0, transparent 40%), #3a211e",
    visual: "script",
  },
  {
    number: "04",
    eyebrow: "Record",
    title: "Record with the level of prompting you want",
    description:
      "Use no teleprompter, speaker notes, or the full script. Set your pace, choose your camera and microphone, and keep every take attached to the idea.",
    href: "/features/teleprompter-recorder",
    accent: "#ff5d5d",
    backdrop:
      "radial-gradient(circle at 82% 16%, #fb7185 0, transparent 38%), radial-gradient(circle at 20% 84%, #0ea5e9 0, transparent 42%), #14253c",
    visual: "record",
  },
  {
    number: "05",
    eyebrow: "Edit",
    title: "Clean the whole take in one click",
    description:
      "Remove mistakes, retakes, filler words, and long silences automatically. Fine-tune the cut by editing the transcript, then add word-synced captions with one click.",
    href: "/features/transcript-video-editor",
    accent: "#22d3ee",
    backdrop:
      "radial-gradient(circle at 20% 22%, #22d3ee 0, transparent 40%), radial-gradient(circle at 82% 82%, #1d4ed8 0, transparent 44%), #111827",
    visual: "edit",
  },
  {
    number: "06",
    eyebrow: "Package",
    title: "Build everything the post needs",
    description:
      "Create platform-ready titles and captions, generate thumbnail options, and prepare the finished video for every destination without rebuilding the post.",
    href: "/features/creator-feedback",
    accent: "#34d399",
    backdrop:
      "radial-gradient(circle at 78% 18%, #34d399 0, transparent 38%), radial-gradient(circle at 18% 82%, #8b5cf6 0, transparent 42%), #132b2a",
    visual: "polish",
  },
  {
    number: "07",
    eyebrow: "Publish",
    title: "Schedule once and publish everywhere",
    description:
      "Schedule or cross-post to every connected social account with one click. Keep every post in your library and turn performance into learnings you can review and edit.",
    href: "/features/social-publishing",
    accent: "#60a5fa",
    backdrop:
      "radial-gradient(circle at 16% 18%, #60a5fa 0, transparent 38%), radial-gradient(circle at 86% 82%, #f472b6 0, transparent 42%), #1e2538",
    visual: "publish",
  },
];

function WindowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[590px] overflow-hidden rounded-[18px] border border-white/15 bg-[#111214] shadow-[0_28px_70px_rgba(0,0,0,.38)]">
      <div className="flex h-9 items-center gap-1.5 border-b border-white/10 px-3">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[9px] font-semibold tracking-wide text-white/35">
          Yapper Studio
        </span>
      </div>
      {children}
    </div>
  );
}

function IdeasVisual() {
  return (
    <WindowFrame>
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold text-white">Idea Bank</span>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[8px] text-white/45">
            24 references
          </span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.07] p-3">
          <p className="text-[11px] leading-5 text-white/85">
            A video about why your best ideas disappear before you film them
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-amber-400 via-pink-500 to-violet-600">
              <Camera className="h-3 w-3 text-white" />
            </span>
            <span className="truncate text-[10px] text-[#8ec7ff]">
              instagram.com/reel/saved-inspiration
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-dashed border-white/15 pt-3">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/55">
              <Mic className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 text-[9px] text-white/35">
              Add context by voice or text…
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-black">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

function ChirpyVisual() {
  return (
    <WindowFrame>
      <div className="grid gap-3 p-4 sm:grid-cols-[92px_1fr] sm:p-5">
        <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-inner">
          <span className="text-4xl">🐥</span>
          <span className="mt-1 text-[9px] font-bold">Chirpy</span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.06] p-3">
          <p className="text-[10px] font-bold text-white">
            What should I post this week?
          </p>
          <p className="mt-2 text-[9px] leading-4 text-white/50">
            Your “creator systems” references keep returning. Here are three
            angles that build on what your audience already responded to:
          </p>
          <div className="mt-2 grid gap-1.5">
            {[
              "The capture habit",
              "Why drafts die",
              "Your idea-to-post loop",
            ].map((idea) => (
              <div
                key={idea}
                className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-[9px] text-white/75"
              >
                <Lightbulb className="h-3 w-3 text-amber-300" /> {idea}
              </div>
            ))}
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

function ScriptVisual() {
  return (
    <WindowFrame>
      <div className="grid min-h-56 grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr]">
        <div className="border-r border-white/10 p-3">
          <p className="text-[8px] font-bold tracking-widest text-white/35 uppercase">
            Hooks
          </p>
          {["Curiosity", "Contrarian", "Story"].map((hook, index) => (
            <div
              key={hook}
              className={`mt-2 rounded-lg px-2 py-2 text-[9px] ${index === 0 ? "bg-amber-400 text-black" : "bg-white/[.05] text-white/45"}`}
            >
              {hook}
            </div>
          ))}
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 text-[9px] font-bold text-amber-300">
            <WandSparkles className="h-3.5 w-3.5" /> Script draft
          </div>
          <p className="mt-3 text-[13px] leading-5 font-semibold text-white">
            Your ideas are not the problem. Your capture system is.
          </p>
          <div className="mt-3 space-y-2">
            <div className="h-1.5 w-full rounded-full bg-white/15" />
            <div className="h-1.5 w-[92%] rounded-full bg-white/10" />
            <div className="h-1.5 w-[78%] rounded-full bg-white/10" />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-[8px] text-white/35">
              Sounds like your voice
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-bold text-black">
              Send to recorder
            </span>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

function RecordVisual() {
  return (
    <WindowFrame>
      <div className="relative flex min-h-64 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_20%,#36546d,transparent_38%),linear-gradient(#14202c,#080b10)] p-4">
        <div className="relative h-52 w-32 overflow-hidden rounded-[22px] border-2 border-white/25 bg-gradient-to-b from-slate-600 to-slate-900 shadow-2xl">
          <div className="absolute inset-x-3 top-4 rounded-xl bg-black/55 px-2 py-2 text-center text-[8px] leading-3 text-white/85 backdrop-blur">
            Your ideas are not the problem.
            <br />
            <strong>Your capture system is.</strong>
          </div>
          <div className="absolute right-4 bottom-5 left-4 h-20 rounded-t-full bg-[#c48b6c] opacity-75" />
          <div className="absolute bottom-3 left-1/2 h-9 w-9 -translate-x-1/2 rounded-full border-4 border-white/70 bg-red-500" />
        </div>
        <div className="absolute top-4 left-4 rounded-full border border-white/10 bg-black/35 px-2.5 py-1.5 text-[8px] text-white/65">
          Teleprompter · 1.0×
        </div>
        <div className="absolute right-4 bottom-4 flex gap-1.5">
          <span className="rounded-full bg-black/40 px-2 py-1 text-[8px] text-white/60">
            9:16
          </span>
          <span className="rounded-full bg-black/40 px-2 py-1 text-[8px] text-white/60">
            Mic on
          </span>
        </div>
      </div>
    </WindowFrame>
  );
}

function EditVisual() {
  return (
    <WindowFrame>
      <div className="flex h-9 border-b border-white/10">
        {["Media", "Quick Edit", "Transcript", "Captions"].map((tab) => (
          <span
            key={tab}
            className={`flex items-center border-r border-white/10 px-3 text-[8px] font-semibold ${tab === "Transcript" ? "border-t-2 border-t-orange-400 bg-black/20 text-white" : "text-white/35"}`}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="grid min-h-56 grid-cols-[1.15fr_.85fr]">
        <div className="border-r border-white/10 p-4">
          <div className="flex items-center gap-2 text-[9px] font-bold text-white/75">
            <FileText className="h-3.5 w-3.5 text-orange-400" /> Transcript
          </div>
          <p className="mt-4 text-[12px] leading-6 text-white/80">
            Your ideas are{" "}
            <span className="rounded bg-red-500/20 px-1 text-red-300 line-through">
              um not really
            </span>{" "}
            the problem. Your capture system is.
          </p>
          <div className="mt-4 flex gap-2">
            <span className="rounded-lg bg-orange-400 px-2 py-1 text-[8px] font-bold text-black">
              Remove fillers
            </span>
            <span className="rounded-lg border border-white/10 px-2 py-1 text-[8px] text-white/45">
              Cut silence
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center bg-black/25 p-3">
          <div className="relative h-40 w-24 rounded-xl bg-gradient-to-b from-cyan-900 to-slate-950">
            <Play className="absolute top-1/2 left-1/2 h-7 w-7 -translate-1/2 rounded-full bg-white/90 p-2 text-black" />
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

function PolishVisual() {
  return (
    <WindowFrame>
      <div className="grid min-h-60 gap-3 p-4 sm:grid-cols-[.8fr_1.2fr]">
        <div className="relative flex min-h-44 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-violet-950 to-slate-950">
          <div className="absolute bottom-5 max-w-[90%] rounded-md bg-white px-2 py-1 text-center text-[9px] font-black text-black shadow-lg">
            YOUR CAPTURE SYSTEM IS.
          </div>
          <Captions className="h-8 w-8 text-white/20" />
        </div>
        <div className="grid content-center gap-2">
          {[
            ["Title", "3 options", "Ready"],
            ["Caption", "Platform-ready", "Ready"],
            ["Thumbnail", "4 concepts", "Ready"],
          ].map(([label, value, score]) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/[.05] p-2.5"
            >
              <div className="flex items-center justify-between text-[8px] text-white/40">
                <span>{label}</span>
                <span>{score}</span>
              </div>
              <p className="mt-1 text-[10px] font-bold text-white/85">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </WindowFrame>
  );
}

function PublishVisual() {
  return (
    <WindowFrame>
      <div className="grid min-h-60 gap-3 p-4 sm:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
          <div className="flex items-center gap-2 text-[9px] font-bold text-white">
            <CalendarDays className="h-3.5 w-3.5 text-blue-300" /> August
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {Array.from({ length: 15 }, (_, index) => (
              <div
                key={index}
                className={`aspect-square rounded-md border border-white/[.06] p-1 text-[7px] text-white/25 ${index === 7 ? "bg-blue-400 text-slate-950" : index === 11 ? "bg-pink-400/30 text-pink-100" : ""}`}
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[.05] p-3">
            <p className="text-[8px] text-white/35">Ready to publish</p>
            <p className="mt-1 text-[10px] font-bold text-white">
              The capture habit
            </p>
            <div className="mt-3 flex gap-1.5">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-amber-400 via-pink-500 to-violet-600">
                <Camera className="h-3 w-3 text-white" />
              </span>
              <span className="grid h-6 w-6 place-items-center rounded-md bg-red-500">
                <Play className="h-3 w-3 fill-white text-white" />
              </span>
              <span className="grid h-6 w-6 place-items-center rounded-md bg-black ring-1 ring-white/10">
                <Send className="h-3 w-3 text-white" />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-[9px] font-bold text-emerald-950">
            <Check className="h-3.5 w-3.5" /> Learnings updated
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

function WorkflowVisual({ kind }: { kind: WorkflowStep["visual"] }) {
  if (kind === "ideas") return <IdeasVisual />;
  if (kind === "chirpy") return <ChirpyVisual />;
  if (kind === "script") return <ScriptVisual />;
  if (kind === "record") return <RecordVisual />;
  if (kind === "edit") return <EditVisual />;
  if (kind === "polish") return <PolishVisual />;
  return <PublishVisual />;
}

export default function StudioWorkflowTour() {
  return (
    <section className="border-border bg-background text-foreground border-y px-4 py-20 sm:px-6 sm:py-28">
      <div className="marketing-container grid items-start gap-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
        <div className="lg:sticky lg:top-0 lg:flex lg:h-svh lg:items-center lg:self-start">
          <div>
            <p className="type-label flex items-center gap-2 text-[var(--sg-accent-strong)]">
              <Sparkles className="h-4 w-4" /> The complete workflow
            </p>
            <h2 className="type-h2 mt-4 max-w-md">
              One idea.
              <br />
              One connected path.
            </h2>
            <p className="type-description mt-6 max-w-sm">
              One captured spark stays connected to every developed idea,
              script, take, edit, publishing asset, post, and learning that
              follows.
            </p>
            <Button asChild className="mt-7">
              <a href="#waitlist">
                Join the waitlist
                <ArrowRight />
              </a>
            </Button>
          </div>
        </div>

        <div className="relative flex flex-col">
          {WORKFLOW.map((step, index) => (
            <article
              key={step.number}
              className="relative flex gap-4 [content-visibility:auto] sm:gap-6 lg:min-h-[78svh]"
              style={{ containIntrinsicSize: "0 640px" }}
            >
              <div className="flex w-8 shrink-0 flex-col items-center">
                <span className="bg-foreground text-background relative z-10 grid h-8 w-8 place-items-center rounded-full text-[10px] font-black shadow-[0_0_0_6px_var(--background)]">
                  {index + 1}
                </span>
                {index < WORKFLOW.length - 1 ? (
                  <span className="border-border h-full w-px border-l border-dashed" />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 pb-16 sm:pb-20">
                <div
                  className="overflow-hidden rounded-[26px] border border-white/10 p-4 shadow-[0_30px_90px_rgba(0,0,0,.35)] sm:p-7"
                  style={{ background: step.backdrop }}
                >
                  <WorkflowVisual kind={step.visual} />
                </div>
                <div className="mx-auto mt-6 max-w-xl text-center">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: step.accent }}
                  >
                    {step.eyebrow}
                  </p>
                  <h3 className="type-h3 mt-2">{step.title}</h3>
                  <p className="type-description mx-auto mt-3 max-w-lg text-sm">
                    {step.description}
                  </p>
                  <Link
                    href={step.href}
                    className="text-foreground/75 hover:text-foreground mt-4 inline-flex items-center gap-1.5 text-sm font-semibold no-underline"
                  >
                    See the feature
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
