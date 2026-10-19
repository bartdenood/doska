import { beforeEach, describe, expect, it, vi } from "vitest"
import type { KeyRange } from "@doska/ports"
import type { Runtime } from "../src/runtime"
import { installRuntime } from "../src/runtime"
import {
  CARDS,
  COLUMNS,
  DASHBOARDS,
  META_STORE,
  TEMPLATES,
} from "../src/api/constants"

/** An in-memory `ClientDB`, keyed `store/key` like the hlc test's. */
const rows = new Map<string, unknown>()

const inStore = (store: string) =>
  [...rows.keys()]
    .filter((composite) => composite.startsWith(`${store}/`))
    .map((composite) => composite.slice(store.length + 1))

const db = {
  get: (store: string, key: string) =>
    Promise.resolve(rows.get(`${store}/${key}`)),
  getAll: (store: string) =>
    Promise.resolve(inStore(store).map((key) => rows.get(`${store}/${key}`))),
  set: (store: string, key: string, value: unknown) => {
    rows.set(`${store}/${key}`, value)
    return Promise.resolve()
  },
  delete: (store: string, key: string) => {
    rows.delete(`${store}/${key}`)
    return Promise.resolve()
  },
  keys: (store: string, range?: KeyRange) =>
    Promise.resolve(
      inStore(store)
        .filter((key) => range?.lower === undefined || key >= range.lower)
        .filter(
          (key) =>
            range?.upper === undefined ||
            (range.exclusive?.upper ? key < range.upper : key <= range.upper)
        )
        .sort()
    ),
  clear: (store: string) => {
    for (const key of inStore(store)) rows.delete(`${store}/${key}`)
    return Promise.resolve()
  },
}

const kvStore = new Map<string, string>()

const kv = {
  get: (key: string) => kvStore.get(key) ?? null,
  set: (key: string, value: string) => void kvStore.set(key, value),
  remove: (key: string) => void kvStore.delete(key),
}

const reset = vi.fn()

// The facade opens network connections on construction, and the wipe only ever
// reaches it through `reset`.
vi.mock("../src/api/sync", () => ({ sync: { reset: () => reset() } }))

/** Records and bookkeeping as they stand after account A has synced. */
function seedAccountA() {
  rows.set(`${DASHBOARDS}/board-a`, {
    id: "board-a",
    updatedAt: 5,
    deletedAt: null,
  })
  rows.set(`${COLUMNS}/col-a`, { id: "col-a", updatedAt: 5, deletedAt: null })
  rows.set(`${CARDS}/card-a`, { id: "card-a", updatedAt: 5, deletedAt: null })
  rows.set(`${META_STORE}/cursor:board-a`, 42)
  rows.set(`${META_STORE}/cursor:dashboards-list`, 7)
  rows.set(`${META_STORE}/hlc:last`, 9_000)
  rows.set(`${META_STORE}/deck:user-id`, "user-a")
}

const remaining = () => [...rows.keys()].sort()

/** What the desktop sign-in screen writes before it signs in. */
const useServer = (url: string) => kvStore.set("deck:server-url", url)

const SERVER_A = "https://a.example.com"
const SERVER_B = "https://b.example.com"

/** The user key is scoped by host, not by the URL as typed. */
const HOST_A = "a.example.com"
const HOST_B = "b.example.com"

beforeEach(() => {
  rows.clear()
  kvStore.clear()
  reset.mockClear()
  installRuntime({ db, kv } as unknown as Runtime)
})

describe("reconcileIdentity", () => {
  it("leaves everything alone when the same user signs in again", async () => {
    seedAccountA()
    const before = remaining()

    const { reconcileIdentity } = await import("../src/api/identity")
    expect(await reconcileIdentity("user-a")).toBe(false)

    expect(remaining()).toEqual(before)
    expect(reset).not.toHaveBeenCalled()
  })

  it("wipes records, cursors and dirty queues when a different user signs in", async () => {
    seedAccountA()
    rows.set(`${TEMPLATES}/tpl-a`, { id: "tpl-a", name: "Bug" })
    kvStore.set("doska:last-board", "board-a")

    const { reconcileIdentity } = await import("../src/api/identity")
    expect(await reconcileIdentity("user-b")).toBe(true)

    expect(inStore(CARDS)).toEqual([])
    expect(inStore(COLUMNS)).toEqual([])
    expect(inStore(DASHBOARDS)).toEqual([])
    expect(inStore(TEMPLATES)).toEqual([])
    expect(inStore(META_STORE).sort()).toEqual(["deck:user-id", "hlc:last"])
    expect(rows.get(`${META_STORE}/deck:user-id`)).toBe("user-b")
    // The clock is this device's, not the account's — a regression here issues
    // timestamps that lose LWW silently.
    expect(rows.get(`${META_STORE}/hlc:last`)).toBe(9_000)
    // The board Home would reopen was the previous account's.
    expect(kvStore.has("doska:last-board")).toBe(false)
    expect(reset).toHaveBeenCalledOnce()
  })

  it("destroys nothing when the user signs out", async () => {
    seedAccountA()
    const before = remaining()

    const { reconcileIdentity } = await import("../src/api/identity")
    expect(await reconcileIdentity(null)).toBe(false)

    expect(remaining()).toEqual(before)
    expect(reset).not.toHaveBeenCalled()
  })

  it("adopts local boards on the first sign-in rather than wiping them", async () => {
    rows.set(`${DASHBOARDS}/local`, {
      id: "local",
      updatedAt: 5,
      deletedAt: null,
    })
    rows.set(`${TEMPLATES}/tpl-local`, { id: "tpl-local", name: "Bug" })

    const { reconcileIdentity } = await import("../src/api/identity")
    expect(await reconcileIdentity("user-a")).toBe(false)

    expect(inStore(DASHBOARDS)).toEqual(["local"])
    expect(inStore(TEMPLATES)).toEqual(["tpl-local"])
    expect(rows.get(`${META_STORE}/deck:user-id`)).toBe("user-a")
    expect(reset).not.toHaveBeenCalled()
  })
})

describe("hasUnclaimedLocalBoards", () => {
  it("is false once an account owns this device", async () => {
    seedAccountA()

    const { hasUnclaimedLocalBoards } = await import("../src/api/identity")
    expect(await hasUnclaimedLocalBoards()).toBe(false)
  })

  it("is false for the untouched seed fixtures", async () => {
    rows.set(`${DASHBOARDS}/welcome`, {
      id: "welcome",
      updatedAt: 0,
      deletedAt: null,
    })

    const { hasUnclaimedLocalBoards } = await import("../src/api/identity")
    expect(await hasUnclaimedLocalBoards()).toBe(false)
  })

  it("ignores boards the user has already deleted", async () => {
    rows.set(`${DASHBOARDS}/gone`, {
      id: "gone",
      updatedAt: 5,
      deletedAt: 6,
    })

    const { hasUnclaimedLocalBoards } = await import("../src/api/identity")
    expect(await hasUnclaimedLocalBoards()).toBe(false)
  })

  it("is true for a board created before anyone signed in", async () => {
    rows.set(`${DASHBOARDS}/local`, {
      id: "local",
      updatedAt: 5,
      deletedAt: null,
    })

    const { hasUnclaimedLocalBoards } = await import("../src/api/identity")
    expect(await hasUnclaimedLocalBoards()).toBe(true)
  })
})

describe("reconcileIdentity across servers", () => {
  it("adopts local boards when a second server is signed in to", async () => {
    useServer(SERVER_A)
    seedAccountA()
    rows.set(`${META_STORE}/deck:user-id:${HOST_A}`, "user-a")
    rows.delete(`${META_STORE}/deck:user-id`)

    // The same person, the same login, a different server's id for them.
    useServer(SERVER_B)
    const { reconcileIdentity } = await import("../src/api/identity")
    expect(await reconcileIdentity("user-a-on-b")).toBe(false)

    expect(inStore(DASHBOARDS)).toEqual(["board-a"])
    expect(rows.get(`${META_STORE}/deck:user-id:${HOST_B}`)).toBe("user-a-on-b")
    expect(reset).not.toHaveBeenCalled()
  })

  it("still wipes when a different user signs in to the same server", async () => {
    useServer(SERVER_A)
    seedAccountA()
    rows.set(`${META_STORE}/deck:user-id:${HOST_A}`, "user-a")
    rows.delete(`${META_STORE}/deck:user-id`)

    const { reconcileIdentity } = await import("../src/api/identity")
    expect(await reconcileIdentity("user-b")).toBe(true)

    expect(inStore(DASHBOARDS)).toEqual([])
    expect(reset).toHaveBeenCalledOnce()
  })

  it("moves an unscoped id onto the server in use", async () => {
    useServer(SERVER_A)
    seedAccountA()

    const { migrateUserKey, reconcileIdentity } =
      await import("../src/api/identity")
    await migrateUserKey()
    // Same account, so the move has to land before the comparison or this wipes.
    expect(await reconcileIdentity("user-a")).toBe(false)

    expect(inStore(DASHBOARDS)).toEqual(["board-a"])
    expect(rows.get(`${META_STORE}/deck:user-id:${HOST_A}`)).toBe("user-a")
    expect(rows.has(`${META_STORE}/deck:user-id`)).toBe(false)
    expect(reset).not.toHaveBeenCalled()
  })

  it("reads one server typed two ways as one account", async () => {
    useServer(SERVER_A)
    seedAccountA()
    rows.set(`${META_STORE}/deck:user-id:${HOST_A}`, "user-a")
    rows.delete(`${META_STORE}/deck:user-id`)

    useServer(`http://${HOST_A}/`)
    const { reconcileIdentity } = await import("../src/api/identity")
    expect(await reconcileIdentity("user-a")).toBe(false)

    expect(inStore(DASHBOARDS)).toEqual(["board-a"])
    expect(reset).not.toHaveBeenCalled()
  })

  it("doesn't let a moved id reach a second server", async () => {
    useServer(SERVER_A)
    seedAccountA()

    const { migrateUserKey, reconcileIdentity } =
      await import("../src/api/identity")
    await migrateUserKey()
    await reconcileIdentity("user-a")

    useServer(SERVER_B)
    expect(await reconcileIdentity("user-a-on-b")).toBe(false)
    expect(inStore(DASHBOARDS)).toEqual(["board-a"])
    expect(reset).not.toHaveBeenCalled()
  })
})

describe("hasUnclaimedLocalBoards", () => {
  it("counts boards as unclaimed on a server never signed in to", async () => {
    useServer(SERVER_A)
    seedAccountA()

    const { hasUnclaimedLocalBoards } = await import("../src/api/identity")
    useServer(SERVER_B)
    expect(await hasUnclaimedLocalBoards()).toBe(true)
  })
})
