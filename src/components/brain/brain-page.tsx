"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import AddContextSheet from "@/components/brain/add/add-context-sheet";
import EssentialsCard from "@/components/brain/essentials-card";
import EssentialsSheet from "@/components/brain/essentials-sheet";
import KnowledgeSection from "@/components/brain/knowledge-section";
import PromptPreview from "@/components/brain/recall/prompt-preview";
import SkillsSection from "@/components/brain/skills-section";
import CatalogSheet from "@/components/brain/skills/catalog-sheet";
import SkillEditorSheet from "@/components/brain/skills/skill-editor-sheet";
import {
  useStudioChirpy,
  type ChirpyBrainTools,
} from "@/components/studio-shell/studio-chirpy";
import { PageHeader } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { useBrainBlocks } from "@/hooks/use-brain-blocks";
import { useBrainSkills } from "@/hooks/use-brain-skills";
import { useProject } from "@/hooks/use-project";
import { findKnowledge } from "@/lib/brain/find-knowledge";
import type { ProjectPatch } from "@/lib/project/client";

/**
 * The Brain: what Yapper knows about you, on one page.
 *
 * Essentials, Knowledge, Skills, top to bottom. No overview tab, no hero, no
 * tips card: the page is the overview. Chirpy is reachable from anywhere in
 * Studio, so it is not advertised here either. "What Yapper reads" stays at
 * the bottom behind a disclosure for the rare time you want to check it.
 *
 * Composition only: each section owns its rendering, this file holds the
 * state, the sheets, and the tools Chirpy uses to edit the brain.
 */
export default function BrainPage() {
  const [adding, setAdding] = useState(false);
  const [editingEssentials, setEditingEssentials] = useState(false);
  const [browsingSkills, setBrowsingSkills] = useState(false);
  const [editingSkillID, setEditingSkillID] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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

  const editingSkill =
    skills.find((skill) => skill.id === editingSkillID) ?? null;

  const alerts = [
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
  ].filter((item) => item.error);

  return (
    <div className="mx-auto w-full max-w-4xl pb-24">
      <PageHeader
        title="Brain"
        description="What Yapper knows about you, and how it works with you."
      />

      {alerts.map((item) => (
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

      <div className="space-y-10">
        <EssentialsCard
          project={project}
          pillars={pillars}
          loading={projectLoading}
          onEdit={() => setEditingEssentials(true)}
        />

        <KnowledgeSection
          blocks={blocks}
          loading={blocksLoading}
          available={blocksAvailable}
          saveFailed={blockSaveState === "error"}
          onAdd={() => setAdding(true)}
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

        <SkillsSection
          skills={skills}
          loading={skillsLoading}
          available={skillsAvailable}
          saveFailed={skillSaveState === "error"}
          onBrowse={() => setBrowsingSkills(true)}
          onCreate={async () => {
            try {
              const created = await addSkill({ name: "New skill" });
              setEditingSkillID(created.id);
              changed();
            } catch {
              /* The alert above offers the retry. */
            }
          }}
          onToggle={(skill, enabled) => {
            editSkill(skill.id, { enabled });
            changed();
          }}
          onOpen={(skill) => setEditingSkillID(skill.id)}
          onRemove={(skill) => {
            if (window.confirm(`Remove “${skill.name}”?`))
              void removeSkill(skill.id)
                .then(changed)
                .catch(() => {});
          }}
        />

        <section className="border-border/70 border-t pt-4">
          <button
            type="button"
            aria-expanded={previewOpen}
            onClick={() => setPreviewOpen((current) => !current)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
          >
            <ChevronRight
              className={`size-3.5 transition-transform ${previewOpen ? "rotate-90" : ""}`}
              aria-hidden="true"
            />
            What Yapper reads
          </button>
          {previewOpen ? (
            <div className="mt-4">
              <PromptPreview version={version} />
            </div>
          ) : null}
        </section>
      </div>

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
