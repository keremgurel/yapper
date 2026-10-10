import { FileText, Lightbulb, Scissors, Send, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import {
  EditBody,
  IdeaBody,
  PublishBody,
  RecordBody,
  ScriptBody,
} from "./step-bodies";

export interface Step {
  id: string;
  label: string;
  title: string;
  Icon: LucideIcon;
  /** The tile color pair, from the sign-in page's workflow palette. */
  tone: string;
  Body: ComponentType;
}

export const STEPS: readonly Step[] = [
  {
    id: "idea",
    label: "Ideas",
    title: "Catch the thought",
    Icon: Lightbulb,
    tone: "idea",
    Body: IdeaBody,
  },
  {
    id: "script",
    label: "Script",
    title: "Shape it in your voice",
    Icon: FileText,
    tone: "script",
    Body: ScriptBody,
  },
  {
    id: "record",
    label: "Record",
    title: "Read it naturally",
    Icon: Video,
    tone: "record",
    Body: RecordBody,
  },
  {
    id: "edit",
    label: "Edit",
    title: "Cut the retakes in one click",
    Icon: Scissors,
    tone: "edit",
    Body: EditBody,
  },
  {
    id: "publish",
    label: "Publish",
    title: "Post everywhere at once",
    Icon: Send,
    tone: "publish",
    Body: PublishBody,
  },
];
