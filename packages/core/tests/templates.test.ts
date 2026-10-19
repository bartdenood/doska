import { beforeEach, describe, expect, it } from "vitest"
import { CARDS, COLUMNS, TEMPLATES } from "../src/api/constants"
import type { Card } from "../src/types"
import { installMemoryRuntime, rows } from "./memory-runtime"

beforeEach(installMemoryRuntime)

const input = {
  name: "Bug",
  title: "Bug: ",
  body: "## Steps\n\n- [ ] repro",
  tags: ["#bug", "bug", "nope!"],
  priority: "high",
}

describe("templates", () => {
  it("starts empty, including a database that never had the store", async () => {
    const { listTemplates } = await import("../src/api/operations/templates")
    expect(await listTemplates()).toEqual([])
  })

  it("creates, renames, edits and deletes a template", async () => {
    const { createTemplate, deleteTemplate, listTemplates, updateTemplate } =
      await import("../src/api/operations/templates")

    const created = await createTemplate(input)
    expect(created.id.startsWith("tpl-")).toBe(true)
    expect(created.name).toBe("Bug")
    expect(created.title).toBe("Bug:")
    expect(created.body).toBe(input.body)
    expect(created.tags).toEqual(["bug"])
    expect(created.priority).toBe("high")

    const renamed = await updateTemplate(created.id, {
      ...input,
      name: "  Defect  ",
      title: "Broken button",
      priority: "nope",
      tags: [],
    })
    expect(renamed.name).toBe("Defect")
    expect(renamed.title).toBe("Broken button")
    expect(renamed.priority).toBe("")
    expect(renamed.tags).toEqual([])
    expect(renamed.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)

    expect((await listTemplates()).map((template) => template.name)).toEqual([
      "Defect",
    ])

    await deleteTemplate(created.id)
    expect(await listTemplates()).toEqual([])
    await deleteTemplate(created.id)
  })

  it("rejects an empty name and writes nothing", async () => {
    const { createTemplate, listTemplates } =
      await import("../src/api/operations/templates")
    await expect(createTemplate({ ...input, name: "   " })).rejects.toThrow(
      /name/
    )
    expect(await listTemplates()).toEqual([])
  })

  it("reads an older row that has no tags or priority", async () => {
    rows.set(`${TEMPLATES}/tpl-old`, {
      id: "tpl-old",
      name: "  Note  ",
      title: "Standup",
    })
    rows.set(`${TEMPLATES}/garbage`, { id: 1, leftover: true })

    const { listTemplates } = await import("../src/api/operations/templates")
    expect(await listTemplates()).toEqual([
      {
        id: "tpl-old",
        name: "Note",
        title: "Standup",
        body: "",
        tags: [],
        priority: "",
        updatedAt: 0,
        deletedAt: null,
        stamps: {},
      },
    ])
  })

  it("duplicates the card fields under a new name", async () => {
    const { createTemplate, duplicateTemplate, listTemplates } =
      await import("../src/api/operations/templates")
    const created = await createTemplate(input)
    const first = await duplicateTemplate(created.id)
    const second = await duplicateTemplate(created.id)

    expect(first.id).not.toBe(created.id)
    expect(first.name).toBe("Bug copy")
    expect(first.title).toBe(created.title)
    expect(first.body).toBe(created.body)
    expect(first.tags).toEqual(created.tags)
    expect(first.priority).toBe(created.priority)
    expect(second.name).toBe("Bug copy 2")
    expect((await listTemplates()).map((template) => template.name)).toEqual([
      "Bug",
      "Bug copy",
      "Bug copy 2",
    ])
  })

  it("fills a new card from a template and leaves the template put", async () => {
    rows.set(`${COLUMNS}/todo`, { id: "todo", deletedAt: null })
    const { createTemplate, cardDraftFromTemplate, getTemplate } =
      await import("../src/api/operations/templates")
    const { createCard } = await import("../src/api/operations/create-card")

    const template = await createTemplate(input)
    const id = await createCard("todo", cardDraftFromTemplate(template))
    const card = rows.get(`${CARDS}/${id}`) as Card

    expect(card.title).toBe(template.title)
    expect(card.body).toBe(template.body)
    expect(card.tags).toEqual(template.tags)
    expect(card.priority).toBe(template.priority)
    expect(await getTemplate(template.id)).toEqual(template)
  })

  it("refuses to update or duplicate a template that is gone", async () => {
    const { duplicateTemplate, updateTemplate } =
      await import("../src/api/operations/templates")
    await expect(updateTemplate("tpl-missing", input)).rejects.toThrow(
      /deleted/
    )
    await expect(duplicateTemplate("tpl-missing")).rejects.toThrow(/deleted/)
  })
})
