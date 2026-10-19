import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  TEMPLATES,
  allTemplates,
  createTemplate,
  listTemplates,
  mergeRemoteTemplates,
  sync,
  updateTemplate,
} from "@doska/core"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { TEMPLATES_FILE } from "../src/templates-file"
import { Vault, type VaultTemplates } from "../src/vault"
import { installBoard, makeColumn } from "./board"
import { nodeFs } from "./node-fs"

const TODO = makeColumn("col-todo", "To do", "a0")

const input = {
  name: "Bug",
  title: "Bug:",
  body: "steps",
  tags: ["bug"],
  priority: "high",
}

function port(): VaultTemplates {
  return {
    load: () => allTemplates(),
    merge: async (remote) => {
      const changed = await mergeRemoteTemplates(remote)
      for (const id of changed) sync.markDirty(TEMPLATES, id)
      return changed.length > 0
    },
  }
}

describe("template folder sync", () => {
  let root: string

  const filePath = () => join(root, TEMPLATES_FILE)
  const readTemplates = () => readFile(filePath(), "utf8")

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vault-templates-"))
    await installBoard([TODO])
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  function vault(options?: {
    templates?: boolean
    onTemplatesChange?: () => void
    onError?: (error: unknown) => void
  }) {
    return new Vault({
      fs: nodeFs(),
      board: {
        load: async () => ({ columns: [TODO], cards: [] }),
        createCard: async () => "unused",
        createColumn: async () => "unused",
        updateCard: async () => {},
        moveCardToColumn: async () => {},
        renameColumn: async () => {},
        deleteCard: async () => {},
        restoreCard: async () => {},
        deleted: async () => ({ columns: [], cards: [] }),
      },
      boardId: "board-1",
      root,
      templates: options?.templates === false ? undefined : port(),
      onTemplatesChange: options?.onTemplatesChange,
      onError: options?.onError,
    })
  }

  it("writes local templates into a folder that has none, and keeps them", async () => {
    const created = await createTemplate(input)
    await vault().sync()

    const text = await readTemplates()
    expect(text).toContain(created.id)
    expect(text).toContain("Bug:")
    expect(await listTemplates()).toHaveLength(1)

    await vault().sync()
    expect(await readTemplates()).toBe(text)
    expect(await allTemplates()).toHaveLength(1)
  })

  it("adopts a folder's templates on a device that doesn't have them yet", async () => {
    const created = await createTemplate(input)
    await vault().sync()

    await installBoard([TODO])
    expect(await listTemplates()).toEqual([])

    let merged = 0
    await vault({ onTemplatesChange: () => merged++ }).sync()
    expect(merged).toBe(1)
    const adopted = await listTemplates()
    expect(adopted.map((template) => template.id)).toEqual([created.id])
    expect(adopted[0]?.title).toBe("Bug:")
    expect(await allTemplates()).toHaveLength(1)
  })

  it("merges a title edit and a body edit, and tombstones a delete", async () => {
    const created = await createTemplate(input)
    await vault().sync()
    const before = JSON.parse(await readTemplates()) as {
      templates: {
        body: string
        stamps: Record<string, number>
        updatedAt: number
      }[]
    }

    await updateTemplate(created.id, { ...input, title: "Local title" })
    const remote = structuredClone(before)
    remote.templates[0]!.body = "from the folder"
    remote.templates[0]!.stamps.body = before.templates[0]!.updatedAt + 100_000
    remote.templates[0]!.updatedAt = before.templates[0]!.updatedAt + 100_000
    await writeFile(filePath(), `${JSON.stringify(remote, null, 2)}\n`, "utf8")

    await vault().sync()
    const merged = (await listTemplates())[0]
    expect(merged?.title).toBe("Local title")
    expect(merged?.body).toBe("from the folder")
    expect(await allTemplates()).toHaveLength(1)

    const deletedAt = Date.now() + 100_000
    const file = JSON.parse(await readTemplates()) as {
      templates: {
        deletedAt: number | null
        updatedAt: number
        stamps: Record<string, number>
      }[]
    }
    file.templates[0]!.deletedAt = deletedAt
    file.templates[0]!.updatedAt = deletedAt
    file.templates[0]!.stamps.deleted = deletedAt
    await writeFile(filePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8")
    await vault().sync()

    expect(await listTemplates()).toEqual([])
    expect((await allTemplates())[0]?.deletedAt).toBe(deletedAt)
  })

  it("keeps local templates when the file is missing, invalid, or a future version", async () => {
    const created = await createTemplate({ ...input, name: "Local" })
    await vault().sync()
    await rm(filePath())

    await vault().sync()
    expect(await listTemplates()).toHaveLength(1)
    expect(await readTemplates()).toContain(created.id)

    const broken = "{not json"
    await writeFile(filePath(), broken, "utf8")
    const errors: unknown[] = []
    await vault({ onError: (error) => errors.push(error) }).sync()
    expect(await readTemplates()).toBe(broken)
    expect(errors).toHaveLength(1)
    expect(await listTemplates()).toHaveLength(1)

    const future = '{"version":2,"templates":[]}\n'
    await writeFile(filePath(), future, "utf8")
    await vault().sync()
    expect(await readTemplates()).toBe(future)
    expect((await listTemplates()).map((template) => template.id)).toEqual([
      created.id,
    ])
  })

  it("an older vault leaves _templates.json alone", async () => {
    const text =
      '{"templates":[{"id":"tpl-old","name":"Note","updatedAt":1}]}\n'
    await writeFile(filePath(), text, "utf8")
    await vault({ templates: false }).sync()
    expect(await readTemplates()).toBe(text)
  })
})
