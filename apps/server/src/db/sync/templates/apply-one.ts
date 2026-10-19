import { TEMPLATE_FIELD_GROUP, type TemplateChange } from "@doska/contract"
import { mergeRecord } from "@doska/merge"
import { and, eq } from "drizzle-orm"
import { cardTemplates } from "../../schema"
import type { Tx } from "../core/counter"

type TemplateRow = typeof cardTemplates.$inferSelect

/**
 * Merges one template into the caller's rows, group by group (see
 * `@doska/merge`), stamping `nextSeq`. Returns whether it wrote. A row for
 * another account is unreachable: the primary key includes `userId`.
 */
export async function applyOne(
  tx: Tx,
  change: TemplateChange,
  nextSeq: number,
  userId: string
): Promise<boolean> {
  const { record } = change
  const [stored] = await tx
    .select()
    .from(cardTemplates)
    .where(
      and(eq(cardTemplates.userId, userId), eq(cardTemplates.id, record.id))
    )
    .for("update")

  const incoming: TemplateRow = {
    userId,
    id: record.id,
    name: record.name,
    title: record.title,
    body: record.body,
    tags: record.tags,
    priority: record.priority,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    stamps: record.stamps,
    seq: nextSeq,
  }
  const merged = mergeRecord(stored, incoming, TEMPLATE_FIELD_GROUP)
  if (!merged.changed) return false

  const row: TemplateRow = { ...merged.record, userId, seq: nextSeq }
  await tx
    .insert(cardTemplates)
    .values(row)
    .onConflictDoUpdate({
      target: [cardTemplates.userId, cardTemplates.id],
      set: row,
    })
  return true
}
