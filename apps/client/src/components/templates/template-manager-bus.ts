/**
 * Opens the template manager from the add-card menu without threading a
 * callback through the board. The settings button hosts the modal and
 * subscribes; a call before that mount does nothing.
 */
const listeners = new Set<() => void>()

export function requestTemplateManager(): void {
  for (const listener of listeners) listener()
}

export function subscribeTemplateManager(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
