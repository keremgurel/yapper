"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Wand2 } from "lucide-react";
import AddContextSheet from "@/components/brain/add/add-context-sheet";
import SetupSheet from "@/components/brain/setup/setup-sheet";
import { useBrainSetup } from "@/hooks/use-brain-setup";
import { SETUP_HANDOFF_KEY } from "@/lib/brain/setup-client";
import EssentialsView from "@/components/brain/essentials/essentials-view";
import FillInMenu from "@/components/brain/fill-in-menu";
import WhatYapperReads from "@/components/brain/essentials/what-yapper-reads";
import VoiceSheet from "@/components/brain/voice/voice-sheet";
import { PageHeader, Section } from "@/components/studio-ui";
import { useVoiceSamples } from "@/hooks/use-voice-samples";
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

/** Essentials say who the creator is, Knowledge says what they know, and
 * Skills say how Yapper should work. Creation and prompt internals stay out of
 * the default path; Chirpy connects this operating system to the rest of Studio. */
export default function BrainPage() {
  const [pickingVideos, setPickingVideos] = useState(false);
  const [adding, setAdding] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
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
  const setup = useBrainSetup({
    existingPillars: pillars,
    saveEssentials,
    addBlock: addKnowledge,
  });
  const { setDocument: setSetupDocument } = setup;
  const setUpFromDocument = useCallback(
    (document: string) => {
      setSetupDocument(document);
      setSettingUp(true);
    },
    [setSetupDocument],
  );
  // A document handed to Chirpy from another page waits in session storage
  // until this page is on screen.
  useEffect(() => {
    let handed: string | null = null;
    try {
      handed = window.sessionStorage.getItem(SETUP_HANDOFF_KEY);
      if (handed) window.sessionStorage.removeItem(SETUP_HANDOFF_KEY);
    } catch {
      handed = null;
    }
    if (!handed) return;
    const document = handed;
    const timer = window.setTimeout(() => setUpFromDocument(document), 0);
    return () => window.clearTimeout(timer);
  }, [setUpFromDocument]);
  const brainTools = useMemo<ChirpyBrainTools>(
    () => ({
      addKnowledge,
      editKnowledge,
      updateEssentials: saveEssentials,
      setUpFromDocument,
    }),
    [addKnowledge, editKnowledge, saveEssentials, setUpFromDocument],
  );

  useEffect(() => {
    chirpy.registerBrainTools(brainTools);
    return () => chirpy.registerBrainTools(null);
  }, [brainTools, chirpy]);

  const activeSkills = skills.filter((skill) => skill.enabled);
  const { samples } = useVoiceSamples(true);
  const editingSkill =
    skills.find((skill) => skill.id === editingSkillID) ?? null;

  return (
    <div className="w-full pb-24">
      <PageHeader
        title="Brain"
        description="What Yapper knows about you. Fill it in yourself, or let it read your videos or a document. Everything here is yours to edit."
        actions={
          <FillInMenu
            videoCount={samples.length}
            onVideos={() => setPickingVideos(true)}
            onDocument={() => setSettingUp(true)}
            onChirpy={() => chirpy.open("Help me fill in my Brain: ")}
          />
        }
      />

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

      <div className="space-y-10">
        <EssentialsView
          project={project}
          pillars={pillars}
          loading={projectLoading}
          saveState={projectSaveState}
          onUpdate={updateEssentials}
          onRetry={retryProject}
        />

        <Section
          title="Knowledge"
          meta={blocksAvailable ? `${blocks.length}` : undefined}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!blocksAvailable}
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" aria-hidden="true" /> Add
            </Button>
          }
        >
          <p className="text-muted-foreground mb-4 max-w-[60ch] text-sm">
            Research, stories, examples, and rules Yapper pulls in when they
            matter.
          </p>
          {blockSaveState === "error" ? (
            <p className="text-destructive mb-3 text-xs" role="alert">
              A memory could not be saved. Your next edit retries it.
            </p>
          ) : null}
          {blocksLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
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
        </Section>

        <Section
          title="Skills"
          meta={
            skillsAvailable
              ? `${activeSkills.length} of ${skills.length} active`
              : undefined
          }
          action={
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBrowsingSkills(true)}
              >
                <Search className="size-4" aria-hidden="true" /> Discover
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
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
                <Plus className="size-4" aria-hidden="true" /> New
              </Button>
            </div>
          }
        >
          <p className="text-muted-foreground mb-4 max-w-[60ch] text-sm">
            Reusable methods Yapper follows when it writes with you. Used when
            relevant, or picked by name while creating.
          </p>
          {skillSaveState === "error" ? (
            <p className="text-destructive mb-3 text-xs" role="alert">
              A skill could not be saved. Your next edit retries it.
            </p>
          ) : null}
          {skillsLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
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
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
            >
              <Wand2 className="size-4" aria-hidden="true" />
              Give Yapper its first creative method
            </button>
          )}
        </Section>

        <WhatYapperReads version={version} />
      </div>
      <VoiceSheet
        open={pickingVideos}
        onOpenChange={setPickingVideos}
        onProfileChanged={() => refreshProject(true)}
      />
      <AddContextSheet
        open={adding}
        onOpenChange={setAdding}
        existingTitles={blocks.map((block) => block.title)}
        onAdd={addKnowledge}
      />
      <SetupSheet
        open={settingUp}
        onOpenChange={setSettingUp}
        setup={setup}
        project={project ?? null}
        existingPillars={pillars.length}
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
