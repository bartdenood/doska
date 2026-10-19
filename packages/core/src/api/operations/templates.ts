import { runtime } from "../../runtime"
import { TEMPLATES } from "../constants"
import { stamp } from "../sync/hlc"
import type { CardDraft } from "./card-draft"
import { normalizePriority, normalizeTags } from "./card-draft"
import { newId } from "./new-id"

const NAME_MAX = 80

/**
 * A reusable starting point for a card. Global on this device: every board
 * offers the same list. Not a board record, and not part of folder or server
 * sync — see `TEMPLATES`.
 */
export interface CardTemplate {
  id: string
  /** Label in the chooser and the manager. Not copied onto the card. */
  name: string
  title: string
  body: string
  tags: string[]
  priority: string
  updatedAt: number
}

export interface TemplateInput {
  name: string
  title: string
  body: string
  tags: string[]
  priority: string
}

/** What `createCard` should pre-fill from a template. */
export function cardDraftFromTemplate(template: CardTemplate): CardDraft {
  return {
    title: template.title,
    body: template.body,
    tags: [...template.tags],
    priority: template.priority,
  }
}

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Give the template a name.")
  if (trimmed.length > NAME_MAX)
    throw new Error("Keep the template name under 80 characters.")
  return trimmed
}

function normalizeInput(
  input: TemplateInput
): Omit<CardTemplate, "id" | "updatedAt"> {
  return {
    name: normalizeName(input.name),
    title: input.title.trim(),
    body: input.body,
    tags: normalizeTags(input.tags),
    priority: normalizePriority(input.priority),
  }
}

/**
 * Reads a stored row, including one written before tags or priority existed.
 * Garbage (no id, no name) is skipped so a bad row can't blank the manager.
 */
function readTemplate(raw: unknown): CardTemplate | null {
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
  }
}

export async function listTemplates(): Promise<CardTemplate[]> {
  const rows = await runtime().db.getAll<unknown>(TEMPLATES)
  return rows
    .map(readTemplate)
    .filter((row): row is CardTemplate => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export async function getTemplate(id: string): Promise<CardTemplate | null> {
  return readTemplate(await runtime().db.get<unknown>(TEMPLATES, id))
}

export async function createTemplate(
  input: TemplateInput
): Promise<CardTemplate> {
  const template: CardTemplate = {
    id: newId("tpl"),
    ...normalizeInput(input),
    updatedAt: stamp(),
  }
  await runtime().db.set(TEMPLATES, template.id, template)
  return template
}

export async function updateTemplate(
  id: string,
  input: TemplateInput
): Promise<CardTemplate> {
  const existing = await getTemplate(id)
  if (!existing) throw new Error("That template was deleted.")
  const template: CardTemplate = {
    ...normalizeInput(input),
    id,
    updatedAt: stamp(),
  }
  await runtime().db.set(TEMPLATES, id, template)
  return template
}

export async function deleteTemplate(id: string): Promise<void> {
  await runtime().db.delete(TEMPLATES, id)
}

function copyName(name: string, taken: Set<string>): string {
  for (let n = 1; n < 1000; n++) {
    const suffix = n === 1 ? " copy" : ` copy ${n}`
    const base = name.slice(0, Math.max(1, NAME_MAX - suffix.length)).trimEnd()
    const candidate = `${base}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  throw new Error("Couldn't find a name for the copy.")
}

/** A new template with the same card fields and a distinct name. */
export async function duplicateTemplate(id: string): Promise<CardTemplate> {
  const source = await getTemplate(id)
  if (!source) throw new Error("That template was deleted.")
  const taken = new Set(
    (await listTemplates()).map((template) => template.name.toLowerCase())
  )
  return createTemplate({
    name: copyName(source.name, taken),
    title: source.title,
    body: source.body,
    tags: source.tags,
    priority: source.priority,
  })
}
