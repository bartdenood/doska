import {
  CardTemplateSchema,
  ChangeSchema,
  DashboardChangeSchema,
  type CardTemplate,
} from "@doska/contract"
import { DirtyStore } from "@doska/sync"
import { beforeEach, describe, expect, it } from "vitest"
import { TEMPLATES } from "../src/api/constants"
import { sync } from "../src/api/sync"
import {
  TemplatesChannelMissing,
  isTemplatesChannelMissing,
} from "../src/api/sync/drivers/template-driver"
import {
  collectTemplateChanges,
  mergeRemoteTemplates,
} from "../src/api/sync/drivers/template-channel"
import { runtime } from "../src/runtime"
import { installMemoryRuntime, rows } from "./memory-runtime"

beforeEach(installMemoryRuntime)

const input = {
  name: "Bug",
  title: "Bug:",
  body: "steps",
  tags: ["bug"],
  priority: "high",
}

function ids(): string[] {
  return [...rows.keys()]
    .filter((key) => key.startsWith(`${TEMPLATES}/`))
    .map((key) => key.slice(TEMPLATES.length + 1))
    .sort()
}

function dirtyStore(): DirtyStore {
  return new DirtyStore(runtime().kv, `templates-test:${Math.random()}`)
}

describe("template sync", () => {
  it("creates, edits and tombstones without a second row", async () => {
    sync.clearDirty()
    const {
      allTemplates,
      createTemplate,
      deleteTemplate,
      listTemplates,
      updateTemplate,
    } = await import("../src/api/operations/templates")

    const created = await createTemplate(input)
    expect(sync.isDirty(TEMPLATES, created.id)).toBe(true)
    expect(created.deletedAt).toBeNull()
    expect(created.stamps?.name).toBe(created.updatedAt)

    const edited = await updateTemplate(created.id, {
      ...input,
      title: "Broken button",
    })
    expect(edited.title).toBe("Broken button")
    expect(edited.stamps?.title).toBeGreaterThanOrEqual(created.updatedAt)
    expect(edited.id).toBe(created.id)

    await deleteTemplate(created.id)
    expect(await listTemplates()).toEqual([])
    expect(await allTemplates()).toHaveLength(1)
    expect((await allTemplates())[0]?.deletedAt).toEqual(expect.any(Number))
    expect(ids()).toEqual([created.id])
    await deleteTemplate(created.id)
    expect(ids()).toEqual([created.id])
  })

  it("migrates an older local row once and does not duplicate it", async () => {
    rows.set(`${TEMPLATES}/tpl-old`, {
      id: "tpl-old",
      name: "Note",
      title: "Standup",
    })

    const first = dirtyStore()
    const { changes } = await collectTemplateChanges(first)
    expect(changes.map((change) => change.record.id)).toEqual(["tpl-old"])
    expect(changes[0]?.record.tags).toEqual([])
    expect(changes[0]?.record.deletedAt).toBeNull()
    expect(changes[0]?.record.stamps).toEqual({})
    expect(ids()).toEqual(["tpl-old"])

    const second = dirtyStore()
    expect(await collectTemplateChanges(second)).toEqual({
      changes: [],
      refs: [],
    })

    await mergeRemoteTemplates([])
    expect(ids()).toEqual(["tpl-old"])

    const { listTemplates } = await import("../src/api/operations/templates")
    await mergeRemoteTemplates([
      {
        ...changes[0]!.record,
        title: "From server",
        updatedAt: 50,
        stamps: { title: 50 },
      },
    ])
    expect(ids()).toEqual(["tpl-old"])
    expect((await listTemplates()).map((template) => template.title)).toEqual([
      "From server",
    ])
  })

  it("keeps both fields when two devices edit different ones", async () => {
    const local: CardTemplate = {
      id: "tpl-1",
      name: "Bug",
      title: "Local title",
      body: "local body",
      tags: ["bug"],
      priority: "high",
      updatedAt: 10,
      deletedAt: null,
      stamps: {
        name: 1,
        title: 10,
        body: 1,
        tags: 1,
        priority: 1,
        deleted: 1,
      },
    }
    rows.set(`${TEMPLATES}/tpl-1`, local)

    const changed = await mergeRemoteTemplates([
      {
        ...local,
        title: "Remote title",
        body: "Remote body",
        updatedAt: 20,
        stamps: {
          name: 1,
          title: 1,
          body: 20,
          tags: 1,
          priority: 1,
          deleted: 1,
        },
      },
    ])

    expect(changed).toEqual(["tpl-1"])
    expect(ids()).toEqual(["tpl-1"])
    const stored = rows.get(`${TEMPLATES}/tpl-1`) as CardTemplate
    expect(stored.title).toBe("Local title")
    expect(stored.body).toBe("Remote body")
    expect(stored.tags).toEqual(["bug"])
    expect(stored.priority).toBe("high")
  })

  it("keeps a newer delete and a newer edit of another field", async () => {
    const { listTemplates } = await import("../src/api/operations/templates")
    const base: CardTemplate = {
      id: "tpl-1",
      name: "Bug",
      title: "Title",
      body: "body",
      tags: [],
      priority: "",
      updatedAt: 1,
      deletedAt: null,
      stamps: {
        name: 1,
        title: 1,
        body: 1,
        tags: 1,
        priority: 1,
        deleted: 1,
      },
    }

    rows.set(`${TEMPLATES}/tpl-1`, {
      ...base,
      deletedAt: 30,
      updatedAt: 30,
      stamps: { ...base.stamps, deleted: 30 },
    })
    await mergeRemoteTemplates([
      {
        ...base,
        title: "Edited later",
        updatedAt: 40,
        stamps: { ...base.stamps, title: 40 },
      },
    ])
    let stored = rows.get(`${TEMPLATES}/tpl-1`) as CardTemplate
    expect(stored.deletedAt).toBe(30)
    expect(stored.title).toBe("Edited later")
    expect(await listTemplates()).toEqual([])

    rows.set(`${TEMPLATES}/tpl-1`, {
      ...base,
      title: "Edited first",
      updatedAt: 40,
      stamps: { ...base.stamps, title: 40 },
    })
    await mergeRemoteTemplates([
      {
        ...base,
        title: "Old title",
        deletedAt: 50,
        updatedAt: 50,
        stamps: { ...base.stamps, deleted: 50 },
      },
    ])
    stored = rows.get(`${TEMPLATES}/tpl-1`) as CardTemplate
    expect(stored.deletedAt).toBe(50)
    expect(stored.title).toBe("Edited first")
    expect(ids()).toEqual(["tpl-1"])
  })

  it("leaves local templates in place when the pull has none", async () => {
    rows.set(`${TEMPLATES}/tpl-local`, {
      id: "tpl-local",
      name: "Note",
      title: "Standup",
      updatedAt: 3,
    })
    expect(await mergeRemoteTemplates([])).toEqual([])
    const { listTemplates } = await import("../src/api/operations/templates")
    expect((await listTemplates()).map((template) => template.id)).toEqual([
      "tpl-local",
    ])
  })

  it("keeps the board and dashboard wire format closed", () => {
    const template = {
      store: "templates",
      record: { id: "tpl-1", name: "Bug", updatedAt: 1 },
    }
    expect(DashboardChangeSchema.safeParse(template).success).toBe(false)
    expect(ChangeSchema.safeParse(template).success).toBe(false)
    expect(
      DashboardChangeSchema.safeParse({
        store: "dashboards",
        record: {
          id: "b",
          title: "Board",
          position: "a",
          updatedAt: 1,
          deletedAt: null,
        },
      }).success
    ).toBe(true)

    const legacy = CardTemplateSchema.parse({
      id: "tpl-1",
      name: "Bug",
      updatedAt: 4,
      deletedAt: null,
    })
    expect(legacy.body).toBe("")
    expect(legacy.tags).toEqual([])
    expect(legacy.priority).toBe("")
    expect(legacy.stamps).toEqual({})
    expect(legacy.deletedAt).toBeNull()
  })

  it("treats a missing templates route as a channel the server doesn't have", () => {
    expect(isTemplatesChannelMissing(new TemplatesChannelMissing())).toBe(true)
    expect(isTemplatesChannelMissing(new Error("offline"))).toBe(false)
  })
})
