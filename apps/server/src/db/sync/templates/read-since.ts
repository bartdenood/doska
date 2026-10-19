import type { TemplateChange } from "@doska/contract"
import { and, eq, gt } from "drizzle-orm"
import { db } from "../../client"
import { cardTemplates } from "../../schema"
import { templatesCounter } from "../constants"

/**
 * Templates this account changed past `since`, plus the templates counter's
 * high-water mark. Other accounts' rows are not visible, even when they share
 * a board.
 */
export async function readSince(
  since: number,
  userId: string
): Promise<{ cursor: number; changes: TemplateChange[] }> {
  const cursor = await templatesCounter().read(db)

  const changes: TemplateChange[] = []
  for (const row of await db
    .select()
    .from(cardTemplates)
    .where(
      and(eq(cardTemplates.userId, userId), gt(cardTemplates.seq, since))
    )) {
    changes.push({
      store: "templates",
      record: {
        id: row.id,
        name: row.name,
        title: row.title,
        body: row.body,
        tags: row.tags,
        priority: row.priority,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
        stamps: row.stamps,
      },
    })
  }

  return { cursor, changes }
}
