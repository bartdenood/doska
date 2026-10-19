import {
  TEMPLATES,
  allTemplates,
  mergeRemoteTemplates,
  sync,
} from "@doska/core"
import type { VaultTemplates } from "@doska/vault"

/**
 * The vault's view of card templates. Folder edits are marked dirty so the
 * server channel hears about them; the server channel merges without marking,
 * or a pull would echo forever.
 */
export function vaultTemplates(): VaultTemplates {
  return {
    load: () => allTemplates(),
    merge: async (remote) => {
      const changed = await mergeRemoteTemplates(remote)
      for (const id of changed) sync.markDirty(TEMPLATES, id)
      return changed.length > 0
    },
  }
}
