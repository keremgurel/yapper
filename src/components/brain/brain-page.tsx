"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import AddContextSheet from "@/components/brain/add/add-context-sheet";
import EssentialsView from "@/components/brain/essentials/essentials-view";
import BlockList from "@/components/brain/blocks/block-list";
import CatalogSheet from "@/components/brain/skills/catalog-sheet";
import SkillCard from "@/components/brain/skills/skill-card";
import SkillEditorSheet from "@/components/brain/skills/skill-editor-sheet";
import {
  useStudioChirpy,
  type ChirpyBrainTools,
} from "@/components/studio-shell/studio-chirpy";
import { Button } from "@/components/ui/button";
import { useBrainBlocks } from "@/hooks/use-brain-blocks";
import { useBrainSkills } from "@/hooks/use-brain-skills";
import { useProject } from "@/hooks/use-project";
import { findKnowledge } from "@/lib/brain/find-knowledge";
import type { ProjectPatch } from "@/lib/project/client";

type BrainView = "essentials" | "knowledge" | "skills";

/** Essentials say who the creator is, Knowledge says what they know, and
 * Skills say how Yapper should work. Creation and prompt internals stay out of
 * the default path; Chirpy connects this operating system to the rest of Studio. */
export default function BrainPage() {
  const [view, setView] = useState<BrainView>("essentials");
  const [adding, setAdding] = useState(false);
  const [browsingSkills, setBrowsingSkills] = useState(false);
  const [editingSkillID, setEditingSkillID] = useState<string | null>(null);
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
            What Yapper knows about you, and the skills it uses to create with
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
        <EssentialsView
          project={project}
          pillars={pillars}
          loading={projectLoading}
          saveState={projectSaveState}
          onUpdate={updateEssentials}
          onRetry={retryProject}
          onRefresh={() => refreshProject(true)}
          version={version}
        />
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
                Skills are invoked when relevant, or selected directly while
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
