import { useEffect, useState } from "react"
import { subscribeTemplateManager } from "./template-manager-bus"
import { TemplateManager } from "./template-manager"

/** Mounted once for the signed-in shell, so the add-card menu can open it. */
export function TemplateManagerHost() {
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeTemplateManager(() => setOpen(true)), [])

  return <TemplateManager open={open} onOpenChange={setOpen} />
}
