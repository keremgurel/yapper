"use client";

import { useCallback, useEffect, useState } from "react";
import AddContextSheet from "@/components/brain/add/add-context-sheet";
import SetupSheet from "@/components/brain/setup/setup-sheet";
import { useBrainSetup } from "@/hooks/use-brain-setup";
import EssentialsView from "@/components/brain/essentials/essentials-view";
import FillInMenu from "@/components/brain/fill-in-menu";
import BrainTabs, { type BrainView } from "@/components/brain/brain-tabs";
import KnowledgeTab from "@/components/brain/knowledge/knowledge-tab";
import SkillsTab from "@/components/brain/skills/skills-tab";
import VoiceSheet from "@/components/brain/voice/voice-sheet";
import { PageHeader } from "@/components/studio-ui";
import { useVoiceSamples } from "@/hooks/use-voice-samples";
import CatalogSheet from "@/components/brain/skills/catalog-sheet";
import SkillEditorSheet from "@/components/brain/skills/skill-editor-sheet";
import { useStudioChirpy } from "@/components/studio-shell/studio-chirpy";
import { Button } from "@/components/ui/button";
import { useBrainBlocks } from "@/hooks/use-brain-blocks";
import { useBrainSkills } from "@/hooks/use-brain-skills";
import { useProject } from "@/hooks/use-project";
import type { NewBrainBlock } from "@/lib/brain/client";
import {
  STUDIO_RESOURCE_KEYS,
  subscribeClientResourceReload,
} from "@/lib/client-resource-cache";
import type { ProjectPatch } from "@/lib/project/client";

/** Essentials say who the creator is, Knowledge says what they know, and
 * Skills say how Yapper should work. Creation and prompt internals stay out of
 * the default path; Chirpy connects this operating system to the rest of Studio. */
export default function BrainPage() {
  const [view, setView] = useState<BrainView>("essentials");
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
  const addKnowledge = useCallback(
    async (block: NewBrainBlock) => {
      const saved = await addBlock(block);
      changed();
      return saved;
    },
    [addBlock, changed],
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
  const { samples, refresh: refreshSamples } = useVoiceSamples(true);
  // A Chirpy turn that changed the Brain on the server; the Essentials
  // reload through their own cache key.
  useEffect(
    () =>
      subscribeClientResourceReload(STUDIO_RESOURCE_KEYS.brain, () => {
        void refreshBlocks();
        void refreshSkills();
        void refreshSamples();
        changed();
      }),
    [changed, refreshBlocks, refreshSkills, refreshSamples],
  );
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

      <BrainTabs
        view={view}
        onChange={setView}
        tabs={[
          { value: "essentials", label: "Essentials" },
          { value: "knowledge", label: "Knowledge", count: blocks.length },
          { value: "skills", label: "Skills", count: skills.length },
        ]}
      />

      {view === "essentials" ? (
        <EssentialsView
          project={project}
          pillars={pillars}
          loading={projectLoading}
          saveState={projectSaveState}
          onUpdate={updateEssentials}
          onRetry={retryProject}
          version={version}
        />
      ) : null}

      {view === "knowledge" ? (
        <KnowledgeTab
          blocks={blocks}
          loading={blocksLoading}
          available={blocksAvailable}
          saveState={blockSaveState}
          onAdd={() => setAdding(true)}
          onEdit={(id, patch) => {
            editBlock(id, patch);
            changed();
          }}
          onRemove={(id) =>
            void removeBlock(id)
              .then(changed)
              .catch(() => {})
          }
          onReorder={(ids) =>
            void reorderBlocks(ids)
              .then(changed)
              .catch(() => {})
          }
        />
      ) : null}

      {view === "skills" ? (
        <SkillsTab
          skills={skills}
          loading={skillsLoading}
          available={skillsAvailable}
          saveState={skillSaveState}
          onDiscover={() => setBrowsingSkills(true)}
          onCreate={async () => {
            try {
              const created = await addSkill({ name: "New skill" });
              setEditingSkillID(created.id);
              changed();
            } catch {
              /* The persistent error banner provides retry. */
            }
          }}
          onToggle={(id, enabled) => {
            editSkill(id, { enabled });
            changed();
          }}
          onOpen={setEditingSkillID}
          onRemove={(id) =>
            void removeSkill(id)
              .then(changed)
              .catch(() => {})
          }
        />
      ) : null}
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
