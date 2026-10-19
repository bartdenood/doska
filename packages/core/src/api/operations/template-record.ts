import {
  TEMPLATE_GROUPS,
  type CardTemplate,
  type TemplateGroup,
} from "@doska/contract"
import { runtime } from "../../runtime"
import { TEMPLATES } from "../constants"
import { normalizePriority, normalizeTags } from "./card-draft"

export type { CardTemplate }

/**
 * Reads a stored row, including one written before tags, priority, stamps, or
 * tombstones existed. Garbage (no id, no name) is skipped so a bad row can't
 * blank the manager or get pushed.
 */
export function readTemplate(raw: unknown): CardTemplate | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== "string" || row.id.length === 0) return null
  if (typeof row.name !== "string" || row.name.trim().length === 0) return null
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((tag): tag is string => typeof tag === "string")
    : []
  return {
    id: row.id,
    name: row.name.trim(),
    title: typeof row.title === "string" ? row.title : "",
    body: typeof row.body === "string" ? row.body : "",
    tags: normalizeTags(tags),
    priority: normalizePriority(
      typeof row.priority === "string" ? row.priority : ""
    ),
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
    deletedAt:
      typeof row.deletedAt === "number" && Number.isFinite(row.deletedAt)
        ? row.deletedAt
        : null,
    stamps: readStamps(row.stamps),
  }
}

function readStamps(raw: unknown): CardTemplate["stamps"] {
  if (!raw || typeof raw !== "object") return {}
  const stamps: CardTemplate["stamps"] = {}
  const record = raw as Record<string, unknown>
  for (const group of TEMPLATE_GROUPS) {
    const value = record[group]
    if (typeof value === "number" && Number.isFinite(value))
      stamps[group] = value
  }
  return stamps
}

/** Every template on this device, tombstones included, in id order. */
export async function allTemplates(): Promise<CardTemplate[]> {
  const rows = await runtime().db.getAll<unknown>(TEMPLATES)
  return rows
    .map(readTemplate)
    .filter((row): row is CardTemplate => row !== null)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function getStoredTemplate(
  id: string
): Promise<CardTemplate | null> {
  return readTemplate(await runtime().db.get<unknown>(TEMPLATES, id))
}

/** Groups whose values differ. A no-op save must not move stamps. */
export function changedGroups(
  existing: CardTemplate,
  next: Pick<CardTemplate, "name" | "title" | "body" | "tags" | "priority">
): TemplateGroup[] {
  const groups: TemplateGroup[] = []
  if (next.name !== existing.name) groups.push("name")
  if (next.title !== existing.title) groups.push("title")
  if (next.body !== existing.body) groups.push("body")
  if (next.priority !== existing.priority) groups.push("priority")
  if (next.tags.join("\0") !== existing.tags.join("\0")) groups.push("tags")
  return groups
}
