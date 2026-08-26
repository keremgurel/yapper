"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import AddContextSheet from "@/components/brain/add/add-context-sheet";
import BlockList from "@/components/brain/blocks/block-list";
import PromptPreview from "@/components/brain/recall/prompt-preview";
import CatalogSheet from "@/components/brain/skills/catalog-sheet";
import SkillCard from "@/components/brain/skills/skill-card";
import SkillEditorSheet from "@/components/brain/skills/skill-editor-sheet";
import PillarEditor from "@/components/project/pillar-editor";
import ProjectField from "@/components/project/project-field";
import {
  useStudioChirpy,
  type ChirpyBrainTools,
} from "@/components/studio-shell/studio-chirpy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SaveState } from "@/hooks/use-autosave";
import { useBrainBlocks } from "@/hooks/use-brain-blocks";
import { useBrainSkills } from "@/hooks/use-brain-skills";
import { useProject } from "@/hooks/use-project";
import { PROJECT_FIELDS, type ProjectPatch } from "@/lib/project/client";

type BrainView = "overview" | "knowledge" | "skills";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      className={`text-xs ${
        state === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
      role={state === "error" ? "alert" : undefined}
    >
      {state === "saving"
        ? "Saving…"
        : state === "saved"
          ? "Saved"
          : "Save failed. Your next edit retries it."}
    </span>
  );
}

function EmptyValue({ children }: { children?: string }) {
  return children ? (
    <span className="text-foreground text-[13px] leading-relaxed font-semibold">
      {children}
    </span>
  ) : (
    <span className="text-muted-foreground text-[13px]">Not set yet</span>
  );
}

function EssentialsSheet({
  open,
  onOpenChange,
  project,
  pillars,
  saveState,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ReturnType<typeof useProject>["project"];
  pillars: ReturnType<typeof useProject>["pillars"];
  saveState: SaveState;
  onUpdate: (patch: ProjectPatch) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle>Your Essentials</SheetTitle>
            <SaveIndicator state={saveState} />
          </div>
          <SheetDescription>
            The foundation Yapper reads whenever it helps you create.
          </SheetDescription>
        </SheetHeader>

        {project ? (
          <div className="space-y-6 px-4 pb-8">
            <div className="space-y-1.5">
              <Label htmlFor="brain-project-name" className="sg-field-label">
                What you call this
              </Label>
              <Input
                id="brain-project-name"
                name="brain-project-name"
                value={project.name}
                placeholder="My channel…"
                autoComplete="off"
                onChange={(event) => onUpdate({ name: event.target.value })}
              />
            </div>

            {PROJECT_FIELDS.map((field) => (
              <ProjectField
                key={field.key}
                id={`brain-essential-${field.key}`}
                label={field.label}
                placeholder={field.placeholder}
                rows={field.rows}
                value={project[field.key]}
                onChange={(value) => onUpdate({ [field.key]: value })}
              />
            ))}

            <PillarEditor
              pillars={pillars}
              onChange={(next) => onUpdate({ pillars: next })}
            />
          </div>
        ) : (
          <p className="text-muted-foreground px-4 py-10 text-sm">
            Your Essentials could not be loaded. Close this and try again.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Essentials say who the creator is, Knowledge says what they know, and
 * Skills say how Yapper should work. Creation and prompt internals stay out of
 * the default path; Chirpy connects this operating system to the rest of Studio. */
export default function BrainPage() {
  const [view, setView] = useState<BrainView>("overview");
  const [adding, setAdding] = useState(false);
  const [editingEssentials, setEditingEssentials] = useState(false);
  const [browsingSkills, setBrowsingSkills] = useState(false);
  const [editingSkillID, setEditingSkillID] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => setVersion((current) => current + 1), []);

  const {
    blocks,
    loading: blocksLoading,
    saveState: blockSaveState,
    edit: editBlock,
    add: addBlock,
    remove: removeBlock,
    reorder: reorderBlocks,
  } = useBrainBlocks();
  const {
    skills,
    loading: skillsLoading,
    saveState: skillSaveState,
    edit: editSkill,
    add: addSkill,
    remove: removeSkill,
    refresh: refreshSkills,
  } = useBrainSkills();
  const {
    project,
    pillars,
    loading: projectLoading,
    saveState: projectSaveState,
    update: updateProject,
  } = useProject(true);
  const chirpy = useStudioChirpy();

  const updateEssentials = useCallback(
    (patch: ProjectPatch) => {
      updateProject(patch);
      changed();
    },
    [changed, updateProject],
  );
  const addKnowledge = useCallback<ChirpyBrainTools["addKnowledge"]>(
    async (block) => {
      const saved = await addBlock(block);
      changed();
      return saved;
    },
    [addBlock, changed],
  );
  const editKnowledge = useCallback<ChirpyBrainTools["editKnowledge"]>(
    (query, patch) => {
      const needle = query.toLowerCase();
      const block = blocks.find(
        (candidate) =>
          candidate.title.toLowerCase() === needle ||
          candidate.title.toLowerCase().includes(needle),
      );
      if (!block) return null;
      editBlock(block.id, patch);
      changed();
      return block;
    },
    [blocks, changed, editBlock],
  );
  const brainTools = useMemo<ChirpyBrainTools>(
    () => ({ addKnowledge, editKnowledge, updateEssentials }),
    [addKnowledge, editKnowledge, updateEssentials],
  );

  useEffect(() => {
    chirpy.registerBrainTools(brainTools);
    return () => chirpy.registerBrainTools(null);
  }, [brainTools, chirpy]);

  const activeSkills = skills.filter((skill) => skill.enabled);
  const recentBlocks = blocks.slice(0, 3);
  const editingSkill =
    skills.find((skill) => skill.id === editingSkillID) ?? null;
  const tabs: { value: BrainView; label: string; count?: number }[] = [
    { value: "overview", label: "Overview" },
    { value: "knowledge", label: "Knowledge", count: blocks.length },
    { value: "skills", label: "Skills", count: skills.length },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl pb-24">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="sg-overline text-[color:var(--sg-accent)]">
            Your creative operating system
          </p>
          <h1 className="font-display text-foreground mt-1 text-3xl font-bold tracking-tight">
            Brain
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-pretty">
            What Yapper knows about you—and the skills it uses to create with
            you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => chirpy.open()}>
            <MessageCircle className="size-4" aria-hidden="true" />
            Ask Chirpy
            <kbd className="bg-muted text-muted-foreground ml-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold">
              ⌘K
            </kbd>
          </Button>
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Teach Your Brain
          </Button>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Brain sections"
        className="border-border mb-6 flex overflow-x-auto border-b"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={view === tab.value}
            onClick={() => setView(tab.value)}
            className={`relative px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              view === tab.value
                ? "text-foreground after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[color:var(--sg-accent)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="bg-muted text-muted-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]">
                {tab.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "overview" ? (
        <div className="space-y-5">
          <section className="grid gap-6 rounded-[24px_6px_24px_24px] bg-[linear-gradient(130deg,var(--sg-ink-950),var(--sg-ink-800))] p-6 text-white shadow-[var(--sg-shadow-panel)] lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-balance">
                Yapper understands your point of view.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
                Your foundation, {blocks.length} pieces of knowledge, and{" "}
                {activeSkills.length} active{" "}
                {activeSkills.length === 1 ? "skill" : "skills"} can shape every
                piece you create.
              </p>
            </div>
            <div className="grid content-center gap-2 text-xs">
              {[
                [
                  "Identity & audience",
                  project?.audience ? "Clear" : "Needs attention",
                ],
                ["Knowledge library", `${blocks.length} memories`],
                ["Creative methods", `${activeSkills.length} active`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-white/65">
                    <Check
                      className="mr-2 inline size-3.5 text-emerald-400"
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                  <strong>{value}</strong>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setView("knowledge")}
                className="mt-1 w-fit text-xs font-semibold text-orange-300 hover:text-orange-200 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:outline-none"
              >
                See everything Yapper knows{" "}
                <ChevronRight className="inline size-3.5" aria-hidden="true" />
              </button>
            </div>
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <section className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <h2 className="text-base font-bold">Your Essentials</h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      The foundation Yapper uses every time.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingEssentials(true)}
                  >
                    Edit
                  </Button>
                </div>
                {projectLoading ? (
                  <p className="text-muted-foreground border-border flex items-center gap-2 border-t p-5 text-sm">
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Loading your Essentials…
                  </p>
                ) : (
                  <div className="border-border grid border-t sm:grid-cols-2">
                    <div className="border-border border-b p-4 sm:border-r">
                      <span className="sg-overline">You make</span>
                      <EmptyValue>{project?.whatIMake}</EmptyValue>
                    </div>
                    <div className="border-border border-b p-4">
                      <span className="sg-overline">For</span>
                      <EmptyValue>{project?.audience}</EmptyValue>
                    </div>
                    <div className="border-border border-b p-4 sm:border-r sm:border-b-0">
                      <span className="sg-overline">Your voice</span>
                      <EmptyValue>{project?.voice}</EmptyValue>
                    </div>
                    <div className="p-4">
                      <span className="sg-overline">Content pillars</span>
                      {pillars.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {pillars.map((pillar) => (
                            <span
                              key={pillar.id ?? pillar.name}
                              className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px]"
                            >
                              {pillar.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[13px]">
                          Not set yet
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold">Active Skills</h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Methods Yapper can apply—not facts it remembers.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("skills")}
                  >
                    Manage All{" "}
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
                {skillsLoading ? (
                  <Loader2
                    className="text-muted-foreground size-4 animate-spin"
                    aria-label="Loading skills"
                  />
                ) : activeSkills.length ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {activeSkills.slice(0, 3).map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => setEditingSkillID(skill.id)}
                        className="border-border bg-background hover:border-foreground/25 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                      >
                        <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--sg-accent)]/10 text-[color:var(--sg-accent-strong)]">
                          <Wand2 className="size-4" aria-hidden="true" />
                        </span>
                        <strong className="mt-3 block truncate text-[13px]">
                          {skill.name}
                        </strong>
                        <span className="text-muted-foreground mt-1 line-clamp-2 block text-[11px]">
                          {skill.whenToUse ||
                            "Available whenever it is relevant."}
                        </span>
                        <span className="mt-2 block text-[10px] font-semibold text-emerald-700">
                          ● Active
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setView("skills")}
                    className="border-border text-muted-foreground hover:text-foreground w-full rounded-xl border border-dashed p-5 text-sm transition-colors"
                  >
                    Browse skills to give Yapper a repeatable method.
                  </button>
                )}
              </section>

              <section className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <h2 className="text-base font-bold">Recently Learned</h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Knowledge Yapper can retrieve when it matters.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("knowledge")}
                  >
                    View Library
                  </Button>
                </div>
                {blocksLoading ? null : recentBlocks.length ? (
                  <div className="border-border divide-border/70 divide-y border-t">
                    {recentBlocks.map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => setView("knowledge")}
                        className="hover:bg-muted/50 flex w-full items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none focus-visible:ring-inset"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color:var(--sg-accent)]/10 text-[color:var(--sg-accent-strong)]">
                          <BookOpen className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[13px]">
                            {block.title}
                          </strong>
                          <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
                            {block.digest || "Added to your Knowledge"}
                          </span>
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {block.usage === "core" ? "Automatic" : "Relevant"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="border-border text-muted-foreground hover:text-foreground w-full border-t p-6 text-sm transition-colors"
                  >
                    Teach your Brain its first piece of Knowledge.
                  </button>
                )}
              </section>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-4">
              {!project?.doNots ? (
                <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-orange-950 dark:border-orange-900/50 dark:bg-orange-950/25 dark:text-orange-100">
                  <p className="sg-overline text-orange-700 dark:text-orange-300">
                    One useful gap
                  </p>
                  <h2 className="mt-2 text-[13px] font-bold text-balance">
                    Teach Yapper what you never want to sound like.
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-orange-900/75 dark:text-orange-100/70">
                    Negative examples make generic creator language easier to
                    avoid.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      chirpy.open(
                        "Add that I never want to sound like an overconfident guru",
                      )
                    }
                  >
                    Add with Chirpy
                  </Button>
                </section>
              ) : null}

              <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[color:var(--sg-accent)]/10">
                    <BrainCircuit
                      className="size-5 text-[color:var(--sg-accent-strong)]"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <h2 className="text-[13px] font-bold">
                      Work on your Brain with Chirpy
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      He knows which screen you&apos;re on.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    "Add something I know about my audience",
                    "Change how Yapper describes my voice",
                    "Create an idea from what’s in my Brain",
                  ].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => chirpy.open(label)}
                      className="border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground w-full rounded-lg border px-3 py-2 text-left text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                    >
                      “{label}”
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => chirpy.open()}
                >
                  Ask Chirpy{" "}
                  <span className="text-muted-foreground ml-1 text-[10px]">
                    ⌘K
                  </span>
                </Button>
                <button
                  type="button"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen((current) => !current)}
                  className="border-border text-muted-foreground hover:text-foreground mt-4 flex w-full items-center justify-between border-t pt-3 text-left text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                >
                  Advanced: See What AI Reads
                  <ChevronRight
                    className={`size-3.5 transition-transform ${advancedOpen ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {advancedOpen ? (
                  <div className="mt-4">
                    <PromptPreview version={version} />
                  </div>
                ) : null}
              </section>
            </aside>
          </div>
        </div>
      ) : null}

      {view === "knowledge" ? (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Knowledge
              </h2>
              <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                Research, stories, examples, and beliefs Yapper retrieves when
                they matter.
              </p>
            </div>
            <Button type="button" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden="true" /> Add Knowledge
            </Button>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-sm sm:p-5">
            {blockSaveState === "error" ? (
              <p className="text-destructive mb-3 text-xs" role="alert">
                A memory could not be saved. Your next edit retries it.
              </p>
            ) : null}
            {blocksLoading ? (
              <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading Knowledge…
              </p>
            ) : (
              <BlockList
                blocks={blocks}
                onEdit={(id, patch) => {
                  editBlock(id, patch);
                  changed();
                }}
                onRemove={(id) => {
                  if (window.confirm("Remove this from your Brain?"))
                    void removeBlock(id).then(changed);
                }}
                onReorder={(ids) => void reorderBlocks(ids).then(changed)}
              />
            )}
          </div>
        </section>
      ) : null}

      {view === "skills" ? (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Skills
              </h2>
              <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                Reusable creative methods. Install proven skills or teach Yapper
                a process that works for you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBrowsingSkills(true)}
              >
                <Search className="size-4" aria-hidden="true" /> Discover
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const created = await addSkill({ name: "New skill" });
                  setEditingSkillID(created.id);
                  changed();
                }}
              >
                <Plus className="size-4" aria-hidden="true" /> Create a Skill
              </Button>
            </div>
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-orange-200 bg-[linear-gradient(135deg,var(--sg-surface),var(--sg-surface-sunken))] p-5 dark:border-orange-900/40">
            <div>
              <strong className="block text-sm">
                {activeSkills.length} active{" "}
                {activeSkills.length === 1 ? "skill shapes" : "skills shape"}{" "}
                your work across Yapper.
              </strong>
              <span className="text-muted-foreground mt-1 block text-xs">
                Skills are invoked when relevant—or selected directly while
                creating.
              </span>
            </div>
            <Sparkles
              className="size-6 text-[color:var(--sg-accent)]"
              aria-hidden="true"
            />
          </div>
          {skillSaveState === "error" ? (
            <p className="text-destructive mb-3 text-xs" role="alert">
              A skill could not be saved. Your next edit retries it.
            </p>
          ) : null}
          {skillsLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading Skills…
            </p>
          ) : skills.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onToggle={(enabled) => {
                    editSkill(skill.id, { enabled });
                    changed();
                  }}
                  onOpen={() => setEditingSkillID(skill.id)}
                  onRemove={() => {
                    if (window.confirm(`Remove “${skill.name}”?`))
                      void removeSkill(skill.id).then(changed);
                  }}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBrowsingSkills(true)}
              className="border-border text-muted-foreground hover:text-foreground flex w-full flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center transition-colors"
            >
              <Wand2
                className="mb-3 size-7 text-[color:var(--sg-accent)]"
                aria-hidden="true"
              />
              <strong className="text-foreground text-sm">
                Give Yapper its first creative method
              </strong>
              <span className="mt-1 text-xs">
                Browse official skills or create your own.
              </span>
            </button>
          )}
        </section>
      ) : null}

      <EssentialsSheet
        open={editingEssentials}
        onOpenChange={setEditingEssentials}
        project={project}
        pillars={pillars}
        saveState={projectSaveState}
        onUpdate={updateEssentials}
      />
      <AddContextSheet
        open={adding}
        onOpenChange={setAdding}
        existingTitles={blocks.map((block) => block.title)}
        onAdd={addKnowledge}
      />
      <CatalogSheet
        open={browsingSkills}
        onOpenChange={setBrowsingSkills}
        onInstalled={async () => {
          await refreshSkills();
          changed();
        }}
      />
      <SkillEditorSheet
        skill={editingSkill}
        onClose={() => setEditingSkillID(null)}
        onEdit={(patch) => {
          if (editingSkill) {
            editSkill(editingSkill.id, patch);
            changed();
          }
        }}
      />
    </div>
  );
}
