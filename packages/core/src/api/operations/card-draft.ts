import { toTagName } from "@doska/markdown/core"
import { PRIORITIES } from "@doska/tokens"

/**
 * Fields a new card can start with. Omitted fields stay empty, which is the
 * blank card the add button has always created.
 */
export interface CardDraft {
  title?: string
  body?: string
  tags?: string[]
  priority?: string
}

/** `""` or a known priority id. Anything else is dropped, not stored. */
export function normalizePriority(value: string | undefined): string {
  if (!value) return ""
  return PRIORITIES.some((priority) => priority.id === value) ? value : ""
}

/** Tag names, without `#`, deduped case-insensitively. Invalid names are dropped. */
export function normalizeTags(tags: readonly string[] | undefined): string[] {
  if (!tags) return []
  const out: string[] = []
  for (const raw of tags) {
    if (typeof raw !== "string") continue
    const name = toTagName(raw)
    if (!name) continue
    if (out.some((tag) => tag.toLowerCase() === name.toLowerCase())) continue
    out.push(name)
  }
  return out
}

/** The card fields a draft actually writes. Missing input is a blank card. */
export function applyCardDraft(draft?: CardDraft): {
  title: string
  body: string
  tags: string[]
  priority: string
} {
  return {
    title: draft?.title ?? "",
    body: draft?.body ?? "",
    tags: normalizeTags(draft?.tags),
    priority: normalizePriority(draft?.priority),
  }
}
