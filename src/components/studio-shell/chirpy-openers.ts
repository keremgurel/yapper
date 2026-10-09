/** What Chirpy offers to start with on each Studio surface, and how the panel
 * names where the creator is. */

export function routeLabel(pathname: string): string {
  if (pathname === "/studio/home") return "What would you like to work on?";
  if (pathname.startsWith("/studio/ideas")) return "Ideas";
  if (pathname.startsWith("/studio/brain")) return "Brain";
  if (pathname.startsWith("/studio/library")) return "Canvas";
  if (pathname.startsWith("/studio/inspiration")) return "Inspiration";
  if (pathname.startsWith("/studio/brand")) return "Brand kit";
  return "Studio";
}

export function openers(pathname: string): { label: string; prompt: string }[] {
  if (pathname === "/studio/home") {
    return [
      {
        label: "Cross-post a video",
        prompt:
          "Help me prepare a video for cross-posting. Ask which video and channels, then help me adapt the captions and plan the publishing steps.",
      },
      {
        label: "Capture an idea",
        prompt:
          "Help me capture a new idea. Ask me what it’s about, then help me shape it into an idea I can save.",
      },
      {
        label: "Find content ideas",
        prompt:
          "Suggest five fresh content ideas based on my Brain, audience, and content pillars. Give each one a specific angle and opening hook.",
      },
      {
        label: "Organize my Brain",
        prompt:
          "Review my Brain knowledge for gaps, overlap, and outdated context. Suggest specific changes that would make it more useful for creating content.",
      },
      {
        label: "Write a script",
        prompt:
          "Help me turn an idea into a script in my voice. Ask which idea, format, and length I have in mind.",
      },
      {
        label: "Improve a hook",
        prompt:
          "Help me make a stronger opening hook. Ask for my current hook or topic, then give me five alternatives that fit my audience.",
      },
      {
        label: "Repurpose content",
        prompt:
          "Help me turn existing content into something new. Ask what I want to repurpose, then suggest clips, posts, or follow-up ideas.",
      },
      {
        label: "Plan my week",
        prompt:
          "Help me plan a week of content around my Brain and content pillars. Ask how often I want to post and which channels I’m focusing on.",
      },
    ];
  }
  return routeOpeners(pathname).map((prompt) => ({ label: prompt, prompt }));
}

function routeOpeners(pathname: string): string[] {
  if (pathname.startsWith("/studio/library")) {
    return [
      "Write the script",
      "Give me five hooks",
      "Give me the key points as bullets",
      "Tighten this into 30 seconds",
    ];
  }
  if (pathname.startsWith("/studio/brand")) {
    return ["Show my brand kit", "What can you help me do here?"];
  }
  if (pathname.startsWith("/studio/brain")) {
    return [
      "Add that my audience distrusts overnight-success promises",
      "Change my voice to direct, warm, and skeptical of easy answers",
      "Create an idea about why creator shortcuts make content forgettable",
    ];
  }
  if (pathname.startsWith("/studio/ideas")) {
    return [
      "Create an idea from my audience objections",
      "What idea am I missing this week?",
      "Which pillar needs more attention?",
    ];
  }
  return ["What can you help me do here?", "Show my brand kit"];
}
