import {
  TEMPLATE_GROUPS,
  type CardTemplate,
  type TemplateGroup,
} from "@doska/contract"
import { beforeAll, beforeEach, describe, expect, test } from "vitest"
import { auth } from "../src/auth"
import { rpcClient, resetTables, startServer, type Harness } from "./harness"

let h: Harness
let owner: ReturnType<typeof rpcClient>
let second: ReturnType<typeof rpcClient>

beforeAll(async () => {
  h = await startServer()
  owner = rpcClient(h)

  await auth.api.createUser({
    body: {
      name: "second",
      email: "second-templates@deck.invalid",
      password: "second-password",
      data: { username: "second-templates", displayUsername: "second" },
    },
    headers: new Headers({ cookie: h.cookie }),
  })

  const signIn = await auth.api.signInUsername({
    body: { username: "second-templates", password: "second-password" },
    asResponse: true,
  })
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
  second = rpcClient({ app: h.app, cookie })
})

beforeEach(resetTables)

const stampAll = (at: number): Record<TemplateGroup, number> =>
  Object.fromEntries(TEMPLATE_GROUPS.map((group) => [group, at])) as Record<
    TemplateGroup,
    number
  >

function template(patch: Partial<CardTemplate> = {}): CardTemplate {
  return {
    id: "tpl-1",
    name: "Bug",
    title: "Bug:",
    body: "steps",
    tags: ["bug"],
    priority: "high",
    updatedAt: 1,
    deletedAt: null,
    stamps: stampAll(1),
    ...patch,
  }
}

function touch(
  record: CardTemplate,
  groups: TemplateGroup[],
  at: number
): CardTemplate {
  return {
    ...record,
    updatedAt: Math.max(record.updatedAt, at),
    stamps: {
      ...record.stamps,
      ...Object.fromEntries(groups.map((group) => [group, at])),
    },
  }
}

const push = (record: CardTemplate, since = 0) =>
  owner.templates.sync({
    since,
    changes: [{ store: "templates", record }],
  })

async function read(id = "tpl-1"): Promise<CardTemplate> {
  const res = await owner.templates.sync({ since: 0, changes: [] })
  const hit = res.changes.find((change) => change.record.id === id)
  if (!hit) throw new Error(`${id} not on the account`)
  return hit.record
}

describe("template sync", () => {
  test("an account with no templates pulls an empty channel", async () => {
    const res = await owner.templates.sync({ since: 0, changes: [] })
    expect(res.changes).toEqual([])
    expect(res.cursor).toBe(0)
  })

  test("create, edit and delete round-trip past the cursor", async () => {
    const created = await push(template())
    expect(created.cursor).toBeGreaterThan(0)
    expect(created.changes.map((change) => change.record.id)).toEqual(["tpl-1"])

    const quiet = await owner.templates.sync({
      since: created.cursor,
      changes: [],
    })
    expect(quiet.changes).toEqual([])

    const edited = touch(template({ title: "Broken" }), ["title"], 10)
    const afterEdit = await push(edited, created.cursor)
    expect(afterEdit.changes).toHaveLength(1)
    expect(afterEdit.changes[0]?.record.title).toBe("Broken")

    const deleted = touch(
      template({ title: "Broken", deletedAt: 20 }),
      ["deleted"],
      20
    )
    await push(deleted, afterEdit.cursor)
    expect((await read()).deletedAt).toBe(20)
    expect((await read()).title).toBe("Broken")
  })

  test("a title edit and a body edit from different pushes both land", async () => {
    await push(template())
    await push(touch(template({ title: "From A" }), ["title"], 10))
    await push(touch(template({ body: "From B" }), ["body"], 11))

    const stored = await read()
    expect(stored.title).toBe("From A")
    expect(stored.body).toBe("From B")
    expect(stored.stamps).toMatchObject({ title: 10, body: 11, name: 1 })
    expect(stored.updatedAt).toBe(11)
  })

  test("a delete keeps a later title edit on the tombstone", async () => {
    await push(template())
    await push(touch(template({ deletedAt: 10 }), ["deleted"], 10))
    await push(touch(template({ title: "later" }), ["title"], 12))

    const stored = await read()
    expect(stored.deletedAt).toBe(10)
    expect(stored.title).toBe("later")
  })

  test("a push without stamps reads every group at its updatedAt", async () => {
    await push(template())
    await push(touch(template({ body: "From B" }), ["body"], 10))
    await push(touch(template({ priority: "low" }), ["priority"], 11))

    const legacy: Partial<CardTemplate> = template({
      title: "old",
      updatedAt: 5,
    })
    delete legacy.stamps

    await push(legacy as CardTemplate)
    const stored = await read()
    expect(stored.title).toBe("old")
    expect(stored.body).toBe("From B")
    expect(stored.priority).toBe("low")
    expect(stored.stamps).toMatchObject({ title: 5, body: 10, priority: 11 })
  })

  test("accounts never see each other's templates", async () => {
    await push(template())
    const other = await second.templates.sync({ since: 0, changes: [] })
    expect(other.changes).toEqual([])

    await second.templates.sync({
      since: 0,
      changes: [
        {
          store: "templates",
          record: template({ id: "tpl-2", name: "Theirs" }),
        },
      ],
    })
    const ours = await owner.templates.sync({ since: 0, changes: [] })
    expect(ours.changes.map((change) => change.record.id).sort()).toEqual([
      "tpl-1",
    ])
  })

  test("template writes do not move the dashboard cursor or its payload", async () => {
    const before = await owner.dashboards.sync({ since: 0, changes: [] })
    await push(template())
    const mid = await owner.dashboards.sync({
      since: before.cursor,
      changes: [],
    })
    expect(mid.cursor).toBe(before.cursor)
    expect(mid.changes).toEqual([])

    const after = await owner.dashboards.sync({
      since: mid.cursor,
      changes: [
        {
          store: "dashboards",
          record: {
            id: "b1",
            title: "Board",
            position: "a",
            sort: [],
            updatedAt: 1,
            deletedAt: null,
          },
        },
      ],
    })
    expect(after.changes.map((change) => change.store)).toEqual(["dashboards"])
  })
})
