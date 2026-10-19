import { TEMPLATE_GROUPS } from "@doska/contract"
import { runtime } from "../../runtime"
import { TEMPLATES } from "../constants"
import { sync } from "../sync"
import { stamp } from "../sync/hlc"
import { touchTemplate } from "../sync/touch"
import type { CardDraft } from "./card-draft"
import { normalizePriority, normalizeTags } from "./card-draft"
import { newId } from "./new-id"
import {
  allTemplates,
  changedGroups,
  getStoredTemplate,
  readTemplate,
  type CardTemplate,
} from "./template-record"

export type { CardTemplate }
export { allTemplates, readTemplate }

const NAME_MAX = 80

/**
 * A reusable starting point for a card. Global across boards, and synced with
 * the account: server channel `templates.sync`, and `_templates.json` in each
 * linked folder. Not part of the board or dashboard wire format.
 */
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
): Pick<CardTemplate, "name" | "title" | "body" | "tags" | "priority"> {
  return {
    name: normalizeName(input.name),
    title: input.title.trim(),
    body: input.body,
    tags: normalizeTags(input.tags),
    priority: normalizePriority(input.priority),
  }
}

/** Live templates, by name. Tombstones stay stored so a delete can sync. */
export async function listTemplates(): Promise<CardTemplate[]> {
  return (await allTemplates())
    .filter((template) => template.deletedAt == null)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export async function getTemplate(id: string): Promise<CardTemplate | null> {
  const template = await getStoredTemplate(id)
  if (!template || template.deletedAt != null) return null
  return template
}

export async function createTemplate(
  input: TemplateInput
): Promise<CardTemplate> {
  const now = stamp()
  const template = touchTemplate(
    {
      id: newId("tpl"),
      ...normalizeInput(input),
      updatedAt: now,
      deletedAt: null,
      stamps: {},
    },
    TEMPLATE_GROUPS,
    now
  )
  await runtime().db.set(TEMPLATES, template.id, template)
  sync.markDirty(TEMPLATES, template.id)
  return template
}

export async function updateTemplate(
  id: string,
  input: TemplateInput
): Promise<CardTemplate> {
  const existing = await getTemplate(id)
  if (!existing) throw new Error("That template was deleted.")
  const next = normalizeInput(input)
  const groups = changedGroups(existing, next)
  if (groups.length === 0) return existing
  const template = touchTemplate({ ...existing, ...next }, groups)
  await runtime().db.set(TEMPLATES, id, template)
  sync.markDirty(TEMPLATES, id)
  return template
}

/** Tombstones a template. A hard delete would not reach other devices. */
export async function deleteTemplate(id: string): Promise<void> {
  const existing = await getStoredTemplate(id)
  if (!existing || existing.deletedAt != null) return
  const now = stamp()
  const dead = touchTemplate({ ...existing, deletedAt: now }, ["deleted"], now)
  await runtime().db.set(TEMPLATES, id, dead)
  sync.markDirty(TEMPLATES, id)
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
