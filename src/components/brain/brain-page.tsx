"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { findKnowledge } from "@/lib/brain/find-knowledge";
import { PROJECT_FIELDS, type ProjectPatch } from "@/lib/project/client";

type BrainView = "essentials" | "knowledge" | "skills";

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

function EmptyValue({
  children,
  prompt,
}: {
  children?: string;
  prompt: string;
}) {
  return children ? (
    <span className="text-foreground block text-sm leading-relaxed font-semibold text-pretty">
      {children}
    </span>
  ) : (
    <span className="text-muted-foreground group-hover:text-foreground block text-sm transition-colors">
      {prompt}
      <ChevronRight
        className="ml-1 inline size-3.5 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </span>
  );
}

function EssentialsSheet({
  open,
  onOpenChange,
  project,
  pillars,
  saveState,
  onUpdate,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ReturnType<typeof useProject>["project"];
  pillars: ReturnType<typeof useProject>["pillars"];
  saveState: SaveState;
  onUpdate: (patch: ProjectPatch) => void;
  onRetry: () => Promise<unknown>;
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

        {saveState === "error" ? (
          <div role="alert" className="text-destructive px-4 pb-4 text-sm">
            Your changes are still here but couldn’t be saved.
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => void onRetry().catch(() => {})}
            >
              Try again
            </Button>
          </div>
        ) : null}

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
          <div className="text-muted-foreground px-4 py-10 text-sm">
            <p>Your Essentials could not be loaded.</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => void onRetry().catch(() => {})}
            >
              Try again
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Essentials say who the creator is, Knowledge says what they know, and
 * Skills say how Yapper should work. Creation and prompt internals stay out of
 * the default path; Chirpy connects this operating system to the rest of Studio. */
export default function BrainPage() {
  const [view, setView] = useState<BrainView>("essentials");
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
    available: blocksAvailable,
    saveState: blockSaveState,
    error: blockError,
    refresh: refreshBlocks,
    retry: retryBlocks,
    editAndSave: saveBlock,
    edit: editBlock,
    add: addBlock,
    remove: removeBlock,
    reorder: reorderBlocks,
  } = useBrainBlocks();
  const {
    skills,
    loading: skillsLoading,
    available: skillsAvailable,
    saveState: skillSaveState,
    error: skillError,
    retry: retrySkills,
    edit: editSkill,
    add: addSkill,
    remove: removeSkill,
    reset: resetSkill,
    refresh: refreshSkills,
  } = useBrainSkills();
  const {
    project,
    pillars,
    loading: projectLoading,
    saveState: projectSaveState,
    loadError: projectError,
    refresh: refreshProject,
    retry: retryProject,
    updateAndSave: saveProject,
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
    async (query, patch) => {
      const block = findKnowledge(blocks, query);
      if (!block) return null;
      await saveBlock(block.id, patch);
      changed();
      return block;
    },
    [blocks, changed, saveBlock],
  );
  const saveEssentials = useCallback(
    async (patch: ProjectPatch) => {
      await saveProject(patch);
      changed();
    },
    [saveProject, changed],
  );
  const brainTools = useMemo<ChirpyBrainTools>(
    () => ({ addKnowledge, editKnowledge, updateEssentials: saveEssentials }),
    [addKnowledge, editKnowledge, saveEssentials],
  );

  useEffect(() => {
    chirpy.registerBrainTools(brainTools);
    return () => chirpy.registerBrainTools(null);
  }, [brainTools, chirpy]);

  const activeSkills = skills.filter((skill) => skill.enabled);
  const editingSkill =
    skills.find((skill) => skill.id === editingSkillID) ?? null;
  const tabs: { value: BrainView; label: string; count?: number }[] = [
    { value: "essentials", label: "Essentials" },
    { value: "knowledge", label: "Knowledge", count: blocks.length },
    { value: "skills", label: "Skills", count: skills.length },
  ];

  return (
    <div className="w-full pb-24">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
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
          <Button
            type="button"
            disabled={!blocksAvailable}
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            Teach Your Brain
          </Button>
        </div>
      </header>

      {[
        {
          name: "Essentials",
          error: projectError
            ? "Your Essentials couldn’t be loaded."
            : projectSaveState === "error"
              ? "Your latest Essentials edits couldn’t be saved."
              : null,
          retry:
            projectSaveState === "error"
              ? retryProject
              : () => refreshProject(true),
        },
        {
          name: "Knowledge",
          error:
            blockError ??
            (blockSaveState === "error"
              ? "Your latest Knowledge edits couldn’t be saved."
              : null),
          retry: blockSaveState === "error" ? retryBlocks : refreshBlocks,
        },
        {
          name: "Skills",
          error:
            skillError ??
            (skillSaveState === "error"
              ? "Your latest Skill edits couldn’t be saved."
              : null),
          retry: skillSaveState === "error" ? retrySkills : refreshSkills,
        },
      ]
        .filter((item) => item.error)
        .map((item) => (
          <div
            key={item.name}
            role="alert"
            className="border-destructive/25 bg-destructive/5 text-destructive mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
          >
            <span>{item.error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void item.retry().catch(() => {})}
            >
              Try again
            </Button>
          </div>
        ))}

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

      {view === "essentials" ? (
        <div className="space-y-6">
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
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading your Essentials…
              </p>
            ) : (
              <div className="border-border bg-border grid gap-px border-t sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setEditingEssentials(true)}
                  className="bg-card hover:bg-muted/35 group min-h-28 p-5 text-left transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                >
                  <span className="text-muted-foreground mb-3 block text-[11px] font-bold tracking-[0.16em] uppercase">
                    You make
                  </span>
                  <EmptyValue prompt="Describe what you create">
                    {project?.whatIMake}
                  </EmptyValue>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEssentials(true)}
                  className="bg-card hover:bg-muted/35 group min-h-28 p-5 text-left transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                >
                  <span className="text-muted-foreground mb-3 block text-[11px] font-bold tracking-[0.16em] uppercase">
                    Your audience
                  </span>
                  <EmptyValue prompt="Describe who it is for">
                    {project?.audience}
                  </EmptyValue>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEssentials(true)}
                  className="bg-card hover:bg-muted/35 group min-h-28 p-5 text-left transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                >
                  <span className="text-muted-foreground mb-3 block text-[11px] font-bold tracking-[0.16em] uppercase">
                    Your voice
                  </span>
                  <EmptyValue prompt="Define how you should sound">
                    {project?.voice}
                  </EmptyValue>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEssentials(true)}
                  className="bg-card hover:bg-muted/35 group min-h-28 p-5 text-left transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
                >
                  <span className="text-muted-foreground mb-3 block text-[11px] font-bold tracking-[0.16em] uppercase">
                    Content pillars
                  </span>
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
                    <span className="text-muted-foreground group-hover:text-foreground block text-sm transition-colors">
                      Add your recurring themes
                      <ChevronRight
                        className="ml-1 inline size-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </button>
              </div>
            )}
          </section>
          <section className="border-border/70 border-t pt-4">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((current) => !current)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
            >
              <ChevronRight
                className={`size-3.5 transition-transform ${advancedOpen ? "rotate-90" : ""}`}
                aria-hidden="true"
              />
              What Yapper reads
            </button>
            {advancedOpen ? (
              <div className="mt-4">
                <PromptPreview version={version} />
              </div>
            ) : null}
          </section>
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
            <Button
              type="button"
              disabled={!blocksAvailable}
              onClick={() => setAdding(true)}
            >
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
            ) : !blocksAvailable ? (
              <p className="text-muted-foreground py-6 text-sm">
                Your Knowledge will appear after it loads successfully.
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
                    void removeBlock(id)
                      .then(changed)
                      .catch(() => {});
                }}
                onReorder={(ids) =>
                  void reorderBlocks(ids)
                    .then(changed)
                    .catch(() => {})
                }
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
                disabled={!skillsAvailable}
                onClick={async () => {
                  try {
                    const created = await addSkill({ name: "New skill" });
                    setEditingSkillID(created.id);
                    changed();
                  } catch {
                    /* The persistent error banner provides retry. */
                  }
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
          ) : !skillsAvailable ? (
            <p className="text-muted-foreground py-6 text-sm">
              Your Skills will appear after they load successfully.
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
                      void removeSkill(skill.id)
                        .then(changed)
                        .catch(() => {});
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
        onRetry={project ? retryProject : () => refreshProject(true)}
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
        onReset={async (skill) => {
          await resetSkill(skill);
          changed();
        }}
      />
    </div>
  );
}
