import {
  TEMPLATE_GROUPS,
  type CardTemplate,
  type TemplateGroup,
} from "@doska/contract"

/** Root file for the account's card templates. `_` keeps older vaults off it. */
export const TEMPLATES_FILE = "_templates.json"

/**
 * Reads a templates file. `null` when it isn't ours to merge: broken JSON, a
 * future version, or a shape we would have to guess at. Callers leave the
 * file alone in that case, and they do not delete local templates.
 */
export function parseTemplatesFile(text: string): CardTemplate[] | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  if (record.version !== undefined && record.version !== 1) return null
  if (!Array.isArray(record.templates)) return null

  const templates: CardTemplate[] = []
  for (const item of record.templates) {
    const template = readOne(item)
    if (!template) return null
    templates.push(template)
  }
  return templates
}

/** Stable text, so an unchanged list doesn't rewrite the file. */
export function templatesFileText(templates: readonly CardTemplate[]): string {
  const body = {
    version: 1 as const,
    templates: templates
      .map(canonical)
      .sort((a, b) => a.id.localeCompare(b.id)),
  }
  return `${JSON.stringify(body, null, 2)}\n`
}

function canonical(template: CardTemplate): CardTemplate {
  const stamps: Partial<Record<TemplateGroup, number>> = {}
  let updatedAt = template.updatedAt
  for (const group of TEMPLATE_GROUPS) {
    const at = template.stamps?.[group] ?? template.updatedAt
    stamps[group] = at
    if (at > updatedAt) updatedAt = at
  }
  return {
    id: template.id,
    name: template.name,
    title: template.title,
    body: template.body,
    tags: [...template.tags],
    priority: template.priority,
    updatedAt,
    deletedAt: template.deletedAt ?? null,
    stamps,
  }
}

/** One record. A missing optional field is an older file, not a broken one. */
function readOne(raw: unknown): CardTemplate | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== "string" || row.id.length === 0) return null
  if (typeof row.name !== "string" || row.name.trim().length === 0) return null
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((tag): tag is string => typeof tag === "string")
    : []
  return canonical({
    id: row.id,
    name: row.name.trim(),
    title: typeof row.title === "string" ? row.title : "",
    body: typeof row.body === "string" ? row.body : "",
    tags,
    priority: typeof row.priority === "string" ? row.priority : "",
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
    deletedAt:
      typeof row.deletedAt === "number" && Number.isFinite(row.deletedAt)
        ? row.deletedAt
        : null,
    stamps: readStamps(row.stamps),
  })
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
