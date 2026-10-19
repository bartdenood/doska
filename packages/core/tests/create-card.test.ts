import { beforeEach, describe, expect, it } from "vitest"
import { CARDS, COLUMNS } from "../src/api/constants"
import type { Card } from "../src/types"
import { installMemoryRuntime, rows } from "./memory-runtime"

const stored = (id: string) => rows.get(`${CARDS}/${id}`) as Card

beforeEach(() => {
  installMemoryRuntime()
  rows.set(`${COLUMNS}/todo`, {
    id: "todo",
    deletedAt: null,
    position: "a0",
    dashboardId: "board",
  })
  rows.set(`${CARDS}/existing`, {
    id: "existing",
    columnId: "todo",
    position: "a0",
    title: "Existing",
    deletedAt: null,
  })
})

describe("createCard", () => {
  it("creates a blank card at the top of the column", async () => {
    const { createCard } = await import("../src/api/operations/create-card")
    const id = await createCard("todo")
    const card = stored(id)

    expect(card.columnId).toBe("todo")
    expect(card.title).toBe("")
    expect(card.body).toBe("")
    expect(card.tags).toEqual([])
    expect(card.priority).toBe("")
    expect(card.deletedAt).toBeNull()
    expect(card.position < "a0").toBe(true)
  })

  it("pre-fills title, body, tags and priority from a draft", async () => {
    const { createCard } = await import("../src/api/operations/create-card")
    const id = await createCard("todo", {
      title: "Bug",
      body: "Steps\n\n- [ ] repro",
      tags: ["#bug", "bug", "not a tag!"],
      priority: "high",
    })
    const card = stored(id)

    expect(card.title).toBe("Bug")
    expect(card.body).toBe("Steps\n\n- [ ] repro")
    expect(card.tags).toEqual(["bug"])
    expect(card.priority).toBe("high")
    expect(card.position < stored("existing").position).toBe(true)
  })

  it("drops a priority the card schema does not know", async () => {
    const { createCard } = await import("../src/api/operations/create-card")
    const id = await createCard("todo", { priority: "urgent", title: "Later" })
    expect(stored(id).priority).toBe("")
    expect(stored(id).title).toBe("Later")
  })

  it("refuses a missing or deleted column", async () => {
    const { createCard } = await import("../src/api/operations/create-card")
    await expect(createCard("missing")).rejects.toThrow(/no live column/)
    rows.set(`${COLUMNS}/gone`, { id: "gone", deletedAt: 5 })
    await expect(createCard("gone")).rejects.toThrow(/no live column/)
  })
})
