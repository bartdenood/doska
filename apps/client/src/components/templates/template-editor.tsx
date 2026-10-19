import { toTagName } from "@doska/markdown"
import {
  Button,
  Input,
  ModalTitle,
  PRIORITIES,
  TagChip,
  Textarea,
} from "@doska/ui-kit"
import {
  useCreateTemplate,
  useDeleteTemplate,
  useUpdateTemplate,
  type CardTemplate,
  type TemplateInput,
} from "@doska/core"
import { ChevronLeft, X } from "lucide-react"
import { useState } from "react"

interface IProps {
  template: CardTemplate | null
  onBack: () => void
  onClose: () => void
}

export function TemplateEditor({ template, onBack, onClose }: IProps) {
  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const remove = useDeleteTemplate()
  const [name, setName] = useState(template?.name ?? "")
  const [title, setTitle] = useState(template?.title ?? "")
  const [body, setBody] = useState(template?.body ?? "")
  const [tags, setTags] = useState<string[]>(template?.tags ?? [])
  const [priority, setPriority] = useState(template?.priority ?? "")
  const [tagDraft, setTagDraft] = useState("")
  const [tagError, setTagError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pending = create.isPending || update.isPending || remove.isPending
  const input: TemplateInput = { name, title, body, tags, priority }

  function addTag() {
    const parsed = toTagName(tagDraft)
    if (!tagDraft.trim()) return
    if (!parsed) {
      setTagError("Use letters, numbers, _ and -.")
      return
    }
    setTagError(null)
    setTagDraft("")
    setTags((current) =>
      current.some((tag) => tag.toLowerCase() === parsed.toLowerCase())
        ? current
        : [...current, parsed]
    )
  }

  async function save() {
    setError(null)
    try {
      if (template) await update.mutateAsync({ id: template.id, input })
      else await create.mutateAsync(input)
      onBack()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save the template."
      )
    }
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 max-md:in-[.window-controls]:pl-24">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back to templates"
            onClick={onBack}
          >
            <ChevronLeft />
          </Button>
          <ModalTitle className="truncate">
            {template ? "Edit template" : "New template"}
          </ModalTitle>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto px-3 pb-3">
        <label className="flex flex-col gap-1" htmlFor="template-name">
          <span className="text-sm">Template name</span>
          <Input
            id="template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Bug report"
            autoFocus
            required
            maxLength={80}
            aria-invalid={name.trim().length === 0}
          />
          <span className="text-xs text-muted-foreground">
            Shown in the menu. Not copied onto the card.
          </span>
        </label>

        <label className="flex flex-col gap-1" htmlFor="template-title">
          <span className="text-sm">Card title</span>
          <Input
            id="template-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled card"
          />
        </label>

        <label className="flex flex-col gap-1" htmlFor="template-body">
          <span className="text-sm">Body</span>
          <Textarea
            id="template-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Markdown"
            className="max-h-64 min-h-40 overflow-y-auto font-mono"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm" id="template-priority-label">
            Priority
          </span>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-labelledby="template-priority-label"
          >
            <Button
              type="button"
              size="sm"
              variant={priority === "" ? "secondary" : "ghost"}
              aria-pressed={priority === ""}
              onClick={() => setPriority("")}
            >
              None
            </Button>
            {PRIORITIES.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={priority === option.id ? "secondary" : "ghost"}
                aria-pressed={priority === option.id}
                onClick={() => setPriority(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm" htmlFor="template-tag">
            Tags
          </label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <TagChip key={tag} label={tag}>
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setTags((current) =>
                        current.filter((item) => item !== tag)
                      )
                    }
                  >
                    <X className="size-3" />
                  </button>
                </TagChip>
              ))}
            </div>
          )}
          <Input
            id="template-tag"
            value={tagDraft}
            aria-label="Add tag"
            placeholder="Add a tag and press Enter"
            aria-invalid={!!tagError}
            aria-describedby={tagError ? "template-tag-error" : undefined}
            onChange={(event) => {
              setTagDraft(event.target.value)
              if (tagError) setTagError(null)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== ",") return
              event.preventDefault()
              addTag()
            }}
          />
          {tagError && (
            <span id="template-tag-error" className="text-xs text-destructive">
              {tagError}
            </span>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {confirmDelete && template ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-sm">
              Delete "{template.name}"? Cards already made from it stay.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => remove.mutate(template.id, { onSuccess: onBack })}
            >
              Delete template
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {template && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="ml-auto"
              onClick={onBack}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || name.trim().length === 0}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}
