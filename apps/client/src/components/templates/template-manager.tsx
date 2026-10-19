import { Button, Modal, ModalContent, ModalHeader } from "@doska/ui-kit"
import {
  useDeleteTemplate,
  useDuplicateTemplate,
  useTemplates,
  type CardTemplate,
} from "@doska/core"
import { Copy, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { TemplateEditor } from "./template-editor"

interface IProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplateManager({ open, onOpenChange }: IProps) {
  const { data: templates = [] } = useTemplates()
  const duplicate = useDuplicateTemplate()
  const [editing, setEditing] = useState<CardTemplate | "new" | null>(null)

  function close(next: boolean) {
    if (!next) setEditing(null)
    onOpenChange(next)
  }

  return (
    <Modal open={open} onOpenChange={close}>
      <ModalContent className="md:max-h-[85svh] md:max-w-lg">
        {editing ? (
          <TemplateEditor
            key={editing === "new" ? "new" : editing.id}
            template={editing === "new" ? null : editing}
            onBack={() => setEditing(null)}
            onClose={() => close(false)}
          />
        ) : (
          <TemplateList
            templates={templates}
            onNew={() => setEditing("new")}
            onEdit={setEditing}
            onDuplicate={(id) => {
              duplicate.mutate(id, { onSuccess: (copy) => setEditing(copy) })
            }}
            onClose={() => close(false)}
          />
        )}
      </ModalContent>
    </Modal>
  )
}

function TemplateList({
  templates,
  onNew,
  onEdit,
  onDuplicate,
  onClose,
}: {
  templates: CardTemplate[]
  onNew: () => void
  onEdit: (template: CardTemplate) => void
  onDuplicate: (id: string) => void
  onClose: () => void
}) {
  const remove = useDeleteTemplate()
  const [pendingId, setPendingId] = useState<string | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModalHeader onClose={onClose}>Card templates</ModalHeader>
      <div className="flex flex-col gap-3 overflow-y-auto px-3 pb-3">
        <p className="text-sm text-muted-foreground">
          A template fills in the title, body, tags and priority of a new card.
          Templates are on every board. A blank card is still one click.
        </p>
        <Button type="button" variant="secondary" onClick={onNew}>
          <Plus />
          New template
        </Button>
        {templates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No templates yet.
          </p>
        ) : (
          <ul className="flex flex-col">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center gap-1 py-1">
                {pendingId === template.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Delete {template.name}?
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => {
                        remove.mutate(template.id)
                        setPendingId(null)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-md px-2 py-1 text-left hover:bg-muted"
                      aria-label={`Edit ${template.name}`}
                      onClick={() => onEdit(template)}
                    >
                      <span className="block truncate text-sm">
                        {template.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {template.title || "Untitled card"}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Duplicate ${template.name}`}
                      onClick={() => onDuplicate(template.id)}
                    >
                      <Copy />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${template.name}`}
                      onClick={() => setPendingId(template.id)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
