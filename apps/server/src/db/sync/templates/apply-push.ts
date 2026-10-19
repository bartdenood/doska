import type { TemplateChange } from "@doska/contract"
import { applyChanges } from "../core/apply-changes"
import { templatesCounter } from "../constants"
import { applyOne } from "./apply-one"

/**
 * Applies a client's pushed templates under per-group last-writer-wins,
 * bumping the templates counter once per accepted write.
 */
export function applyPush(
  changes: TemplateChange[],
  userId: string
): Promise<void> {
  return applyChanges(templatesCounter(), changes, (tx, change, nextSeq) =>
    applyOne(tx, change, nextSeq, userId)
  )
}
