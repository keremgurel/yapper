import type { PreviewStep } from "@/components/marketing/studio-preview";

type FeatureDetail = {
  preview: PreviewStep;
  heading: string;
  explanation: string;
  availability: string;
  questions: { question: string; answer: string }[];
};
export const featureDetails: Record<string, FeatureDetail> = {
  "idea-capture": {
    preview: "Idea",
    heading: "A content ideas generator with your context.",
    explanation:
      "Brain keeps your voice, point of view, references and previous videos in context. Add what matters to you and connect your social profile, then ask for ideas you can actually shoot. Keep the original thought attached as you explore an angle in Lab and turn it into a script.",
    availability:
      "Idea capture is included in every Studio membership and in the 7-day free trial.",
    questions: [
      {
        question: "Can I start with something other than a written idea?",
        answer:
          "Studio supports voice, text, and reference links. You can keep the source with the idea as you develop it.",
      },
      {
        question: "How is capture different from script writing?",
        answer:
          "Capture saves the raw thought. Script writing gives a selected idea a hook, a structure, and words you can work with on camera.",
      },
    ],
  },
  "ai-script-writer": {
    preview: "Script",
    heading: "Structure for your point. Room for your voice.",
    explanation:
      "Use the AI video script generator for a short tutorial, a product explanation or a story you want to share. Start with your idea and references, compare hooks, then edit the draft into words you would actually say. Your script stays connected to its source and ready for the teleprompter.",
    availability:
      "Script generation uses Studio credits. Each membership payment includes credits, and the pricing page lists what each action costs.",
    questions: [
      {
        question: "Can I edit the generated script?",
        answer:
          "Yes. The draft is editable. Change the hook, rewrite a section, or use talking points instead of a full script.",
      },
      {
        question: "Can I use the script while recording?",
        answer:
          "Studio’s recorder includes a teleprompter so you can bring the selected script into the recording workflow.",
      },
    ],
  },
  "teleprompter-recorder": {
    preview: "Record",
    heading: "Keep your place without losing your delivery.",
    explanation:
      "Bring the script into the recorder and choose a readable text size and scroll pace. Check the camera and microphone before a take, then keep the recording with the project you are making.",
    availability:
      "Recording and editing use the native Mac app. Camera and microphone access require your permission. A mobile app with teleprompter recording, scan-to-phone handoff and the full Studio editor is coming soon. Windows is not available yet.",
    questions: [
      {
        question: "How do I read a teleprompter naturally on my Mac?",
        answer:
          "Write in short sentences you would actually say, or use key talking points. Adjust the scroll speed and text size before recording, then do a short test take. Leave room for pauses instead of trying to keep up with a dense script.",
      },
      {
        question: "Is this a free public teleprompter?",
        answer:
          "The Mac teleprompter recorder is included in every Studio membership and the 7-day free trial. Recording does not use AI credits.",
      },
    ],
  },
  "transcript-video-editor": {
    preview: "Edit",
    heading: "Find the moment by finding the words.",
    explanation:
      "Start with one-click edit to remove silences and repeated attempts. Review the result, then use text-based video editing to select any words you want to cut. Keep the timeline for precise finishing and add captions before exporting.",
    availability:
      "Editing uses Yapper Studio’s native Mac editor. A browser-only editor, Windows release, and mobile editor are not being offered here.",
    questions: [
      {
        question: "Does deleting transcript text edit the video?",
        answer:
          "The transcript is linked to the recording’s timing. Transcript editing lets you select the words and associated video you want to cut.",
      },
      {
        question: "Can I still make precise timeline edits?",
        answer:
          "Yes. Transcript editing and timeline controls work together, so you can refine cuts, overlays, and audio where more precision is useful.",
      },
    ],
  },
  "automatic-captions": {
    preview: "Edit",
    heading: "The transcript does more than help you cut.",
    explanation:
      "Use the recording’s word timings to create captions. Choose their appearance and placement, then correct the names and specialist vocabulary that matter to your content with the personal dictionary.",
    availability:
      "Caption styling and export happen in the native Mac editor. Always review transcription before publishing.",
    questions: [
      {
        question: "Can I change how the captions look?",
        answer:
          "The editor includes caption styling and placement controls, so you can adapt the text to your video.",
      },
      {
        question: "What is the personal dictionary for?",
        answer:
          "It stores names and vocabulary you commonly use to help reduce repeated transcription corrections. You should still review the result.",
      },
    ],
  },
  "social-publishing": {
    preview: "Publish",
    heading: "Give each destination the right version.",
    explanation:
      "Start with the finished video, then review the cover, caption, and account for each destination. Keep preparation and delivery status together so a draft, a scheduled delivery, and a published post stay distinct.",
    availability:
      "Available destinations depend on connected accounts and platform approvals. Scheduled delivery requires an enabled publishing service; a planning date alone does not publish a post.",
    questions: [
      {
        question: "Does putting a video on the calendar publish it?",
        answer:
          "No. A planning date is different from an armed publishing schedule. Scheduling requires reviewed destinations and an enabled publishing service.",
      },
      {
        question: "Can I customize each platform’s post?",
        answer:
          "Studio’s publishing workflow supports preparing destination-specific details. Exact options and available delivery methods depend on the connected platform.",
      },
    ],
  },
  "content-calendar": {
    preview: "Publish",
    heading: "See the plan and the work behind it.",
    explanation:
      "A useful calendar tells you what needs making, not just what day it is. Organize upcoming content around the ideas, scripts, recordings, and finished pieces already in your workflow.",
    availability:
      "Planned content and scheduled delivery are separate states; automatic publishing requires an enabled service.",
    questions: [
      {
        question: "Is a planned post automatically scheduled?",
        answer:
          "No. Planning tracks the work and its intended date. Automatic delivery requires a separate reviewed schedule and a working publishing connection.",
      },
      {
        question: "Does the calendar stay connected to my content?",
        answer:
          "The calendar is designed around Studio’s content records, so you can return to the underlying idea or project as you plan.",
      },
    ],
  },
  "content-library": {
    preview: "Idea",
    heading: "Keep the context, not just the file.",
    explanation:
      "The finished video started somewhere. Keep its idea, script, takes, and production status in the same workflow, so you can pick it up again without piecing together scattered notes.",
    availability:
      "Storage and access limits are subject to the current account’s plan.",
    questions: [
      {
        question: "What belongs in the library?",
        answer:
          "Content records connect the idea, script, recordings, and production status for a piece you are working on.",
      },
      {
        question: "Is storage unlimited?",
        answer:
          "No. Account storage is limited and managed within Studio. This page does not offer unlimited storage or change existing plan limits.",
      },
    ],
  },
};
