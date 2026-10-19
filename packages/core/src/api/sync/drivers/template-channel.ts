import { TEMPLATE_FIELD_GROUP, type TemplateChange } from "@doska/contract"
import { mergeRecord } from "@doska/merge"
import type { DirtyStore } from "@doska/sync"
import { keys } from "../../../data/keys"
import { queryClient } from "../../../query-client"
import { runtime } from "../../../runtime"
import { META_STORE, TEMPLATES, TEMPLATES_MIGRATED_KEY } from "../../constants"
import {
  allTemplates,
  getStoredTemplate,
  readTemplate,
} from "../../operations/template-record"
import { clock, persistClock } from "../hlc"

/**
 * Template-channel steps. Shared by the server driver and by folder sync: both
 * merge into the same local rows, by id, so a template that already exists is
 * updated in place.
 */

/**
 * Offers templates that were created before this device synced them. One flag,
 * one pass: the same ids are marked dirty, never copied into a second row.
 * Runs at the start of a collect so the pass that notices them also pushes them.
 */
export async function migrateLocalTemplates(dirty: DirtyStore): Promise<void> {
  const flag = await runtime().db.get<boolean>(
    META_STORE,
    TEMPLATES_MIGRATED_KEY
  )
  if (flag) return
  for (const template of await allTemplates()) {
    dirty.mark(`${TEMPLATES}/${template.id}`)
  }
  await runtime().db.set(META_STORE, TEMPLATES_MIGRATED_KEY, true)
}

export async function collectTemplateChanges(
  dirty: DirtyStore
): Promise<{ changes: TemplateChange[]; refs: string[] }> {
  await migrateLocalTemplates(dirty)

  const changes: TemplateChange[] = []
  const refs: string[] = []
  const missing: string[] = []

  for (const ref of dirty.all()) {
    const [store, id] = ref.split("/")
    if (store !== TEMPLATES || !id) continue
    const record = await getStoredTemplate(id)
    if (!record) {
      missing.push(ref)
      continue
    }
    changes.push({ store: TEMPLATES, record })
    refs.push(ref)
  }

  if (missing.length) dirty.drop(missing)
  return { changes, refs }
}

/**
 * Merges pulled or folder-read templates into the local store. Returns the ids
 * that changed. Does not mark them dirty: the server driver must not echo a
 * pull, and folder sync decides for itself whether the other channel should
 * hear about it.
 */
export async function mergeRemoteTemplates(
  remote: readonly unknown[]
): Promise<string[]> {
  const changed: string[] = []

  for (const raw of remote) {
    const incoming = readTemplate(raw)
    if (!incoming) continue
    clock.receive(incoming.updatedAt)

    const local = await getStoredTemplate(incoming.id)
    const { record, changed: did } = mergeRecord(
      local ?? undefined,
      incoming,
      TEMPLATE_FIELD_GROUP
    )
    if (!did) continue
    await runtime().db.set(TEMPLATES, record.id, record)
    changed.push(record.id)
  }

  if (changed.length) {
    void persistClock()
    void queryClient.invalidateQueries({ queryKey: keys.templates })
  }
  return changed
}
