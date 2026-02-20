import type { PromptWithStats } from "@/lib/types";

export type SortKey = "noise" | "newest" | "echoed";

export function extractVariables(text: string): string[] {
  const matches = text.match(/{{\s*[a-zA-Z0-9_.-]+\s*}}/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/[{}\s]/g, "")))];
}

export function sortPrompts(prompts: PromptWithStats[], sortBy: SortKey): PromptWithStats[] {
  return [...prompts].sort((a, b) => {
    if (sortBy === "noise") return b.upvote_count - a.upvote_count;
    if (sortBy === "echoed") return b.copy_count - a.copy_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
