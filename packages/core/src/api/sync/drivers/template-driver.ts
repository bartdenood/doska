import { RETENTION_MS, type TemplateChange } from "@doska/contract"
import type { DirtyStore, PushInput, PushResult, SyncDriver } from "@doska/sync"
import { ORPCError } from "@orpc/client"
import { runtime } from "../../../runtime"
import { TEMPLATES } from "../../constants"
import { getStoredTemplate } from "../../operations/template-record"
import { orpc } from "../orpc"
import * as generic from "./channel-shared"
import {
  collectTemplateChanges,
  mergeRemoteTemplates,
} from "./template-channel"

/** The list is account-level, so its engine stays pointed here for the app's life. */
export const TEMPLATES_SCOPE = "templates"

const CURSOR_KEY = "cursor:templates"

/**
 * The server this client is talking to doesn't have `templates.sync`. Thrown
 * so the engine can keep the dirty refs and try again later, without failing
 * the board and dashboard channels.
 */
export class TemplatesChannelMissing extends Error {
  constructor() {
    super("This server has no templates sync channel.")
    this.name = "TemplatesChannelMissing"
  }
}

export function isTemplatesChannelMissing(err: unknown): boolean {
  if (err instanceof TemplatesChannelMissing) return true
  if (!(err instanceof ORPCError)) return false
  return err.status === 404 || err.code === "NOT_FOUND"
}

/** Syncs card templates against the server via oRPC's `templates.sync`. */
export class TemplateDriver implements SyncDriver<string, TemplateChange> {
  async push(
    input: PushInput<string, TemplateChange>
  ): Promise<PushResult<TemplateChange>> {
    try {
      return await orpc.templates.sync({
        since: input.since,
        changes: input.changes,
      })
    } catch (err) {
      if (isTemplatesChannelMissing(err)) throw new TemplatesChannelMissing()
      throw err
    }
  }

  loadCursor(): Promise<number> {
    return generic.loadCursor(CURSOR_KEY)
  }

  saveCursor(_scope: string, value: number): Promise<void> {
    return generic.saveCursor(CURSOR_KEY, value)
  }

  collectChanges(_scope: string, dirty: DirtyStore) {
    return collectTemplateChanges(dirty)
  }

  async applyRemote(_scope: string, changes: TemplateChange[]): Promise<void> {
    await mergeRemoteTemplates(changes.map((change) => change.record))
  }

  refOf(change: TemplateChange): string {
    return `${TEMPLATES}/${change.record.id}`
  }

  async compact(dirty: DirtyStore, refs: string[]): Promise<void> {
    const cutoff = Date.now() - RETENTION_MS
    for (const ref of refs) {
      if (dirty.has(ref)) continue
      const [store, id] = ref.split("/")
      if (store !== TEMPLATES || !id) continue
      try {
        const record = await getStoredTemplate(id)
        if (record?.deletedAt != null && record.deletedAt < cutoff)
          await runtime().db.delete(TEMPLATES, id)
      } catch (err) {
        console.warn("[sync] compaction failed for", TEMPLATES, id, err)
      }
    }
  }
}
