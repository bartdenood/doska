import { describe, expect, it } from "vitest"
import { parseTemplatesFile, templatesFileText } from "../src/templates-file"

describe("templates file", () => {
  it("reads an older file that has no stamps or deletedAt", () => {
    const parsed = parseTemplatesFile(
      JSON.stringify({
        templates: [
          { id: "tpl-old", name: "Note", title: "Standup", updatedAt: 4 },
        ],
      })
    )
    expect(parsed).toEqual([
      {
        id: "tpl-old",
        name: "Note",
        title: "Standup",
        body: "",
        tags: [],
        priority: "",
        updatedAt: 4,
        deletedAt: null,
        stamps: {
          name: 4,
          title: 4,
          body: 4,
          tags: 4,
          priority: 4,
          deleted: 4,
        },
      },
    ])
  })

  it("rejects a future version and broken JSON", () => {
    expect(parseTemplatesFile('{"version":2,"templates":[]}')).toBeNull()
    expect(parseTemplatesFile("{")).toBeNull()
    expect(parseTemplatesFile('{"templates":[{"id":"x"}]}')).toBeNull()
  })

  it("round-trips a tombstone without dropping fields", () => {
    const text = templatesFileText([
      {
        id: "tpl-b",
        name: "B",
        title: "Bee",
        body: "body",
        tags: ["bug"],
        priority: "low",
        updatedAt: 8,
        deletedAt: 9,
        stamps: { deleted: 9, title: 3 },
      },
      {
        id: "tpl-a",
        name: "A",
        title: "",
        body: "",
        tags: [],
        priority: "",
        updatedAt: 1,
        deletedAt: null,
        stamps: {},
      },
    ])
    const again = templatesFileText(parseTemplatesFile(text) ?? [])
    expect(again).toBe(text)
    expect(text.indexOf("tpl-a")).toBeLessThan(text.indexOf("tpl-b"))
  })
})
