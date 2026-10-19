export const CARDS = "cards"
export const COLUMNS = "columns"
export const DASHBOARDS = "dashboards"
/** The account's sidebar layout: one record under `SIDEBAR_LAYOUT_ID`. */
export const SIDEBAR = "sidebar"
export const SIDEBAR_LAYOUT_ID = "layout"
export const HISTORY = "history"

/**
 * Card templates. Kept out of `STORES` on purpose: that list is what the board,
 * dashboard, and history channels push. Templates have their own channel and
 * their own dirty queue, so an older client never sees them on the channels it
 * already parses.
 */
export const TEMPLATES = "templates"

/** Set once the device has offered its pre-sync templates to the server. */
export const TEMPLATES_MIGRATED_KEY = "templates:migrated"

export const STORES = [CARDS, COLUMNS, DASHBOARDS, SIDEBAR, HISTORY] as const
export type StoreName = (typeof STORES)[number]

/** Sync bookkeeping (the pull cursor) — kept in the DB so it shares the data's
 * lifetime. Not dropped on upgrade, but gone if the whole DB is deleted. */
export const META_STORE = "meta"

/** Index on `cards.columnId`, so a column's cards are a storage-side range seek
 * (`getCards(columnId)`) instead of a full-store scan. The primary key stays the
 * card id, so lookups by id (`getCard`) remain a direct get. */
export const CARDS_BY_COLUMN = "columnId"

/** Index on `cards.deadline` for the digest's date-range reads. Deadlines are
 * `YYYY-MM-DD`, so index order is chronological and a range seek needs no sort.
 * A `null` deadline yields no index key, so undated cards are absent by
 * construction — the index can't answer "cards with no deadline". */
export const CARDS_BY_DEADLINE = "deadline"

export const CARDS_BY_NUMBER = "number"

export const HISTORY_BY_ENTITY = "entityId"
export const HISTORY_BY_CREATED = "createdAt"
