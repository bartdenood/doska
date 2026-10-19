import { createElement } from "react"
import { toast } from "react-hot-toast"
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  cn,
} from "@doska/ui-kit"
import {
  cardDraftFromTemplate,
  useTemplates,
  type CardDraft,
} from "@doska/core"
import { ChevronDown, FileText, LayoutTemplate, Plus } from "lucide-react"
import { AddCardBlockedToast } from "@/components/toasts/add-card-blocked/add-card-blocked-toast"
import { requestTemplateManager } from "./template-manager-bus"

interface IProps {
  appearance: "column" | "header"
  /** Accessible name of the blank-card button. Tests and the old UI use this. */
  label: string
  /** Accessible name of the template menu, distinct from `label`. */
  menuLabel: string
  disabledReason?: string
  onCreate: (draft?: CardDraft) => void
}

/**
 * Blank card on the main control — one click, same as before templates.
 * The menu appears only once a template exists, and stays hidden while adding
 * is blocked (a filter, or a board with no columns).
 */
export function AddCardControl({
  appearance,
  label,
  menuLabel,
  disabledReason,
  onCreate,
}: IProps) {
  const { data: templates = [] } = useTemplates()
  const blocked = !!disabledReason
  const showMenu = templates.length > 0 && !blocked

  function createBlank() {
    if (!blocked) {
      onCreate()
      return
    }
    toast.custom(
      (toastInstance) =>
        createElement(AddCardBlockedToast, {
          visible: toastInstance.visible,
          reason: disabledReason,
        }),
      { id: "add-card-blocked", duration: 2500 }
    )
  }

  const blank =
    appearance === "header" ? (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className="text-muted-foreground"
        onClick={createBlank}
        disabled={blocked}
        tooltip={disabledReason ?? true}
      >
        <Plus />
      </Button>
    ) : (
      <Button
        variant="muted"
        onClick={createBlank}
        aria-disabled={blocked}
        aria-label={label}
        className={cn(
          showMenu ? "min-w-0 flex-1" : "mb-3 w-full",
          blocked && "opacity-50"
        )}
        tooltip={disabledReason ?? false}
      >
        <Plus />
      </Button>
    )

  const menu = showMenu ? (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant={appearance === "header" ? "ghost" : "muted"}
            size={appearance === "header" ? "icon-sm" : "icon"}
            aria-label={menuLabel}
            className={
              appearance === "header" ? "text-muted-foreground" : "shrink-0"
            }
          />
        }
      >
        <ChevronDown />
      </MenuTrigger>
      <MenuContent className="max-h-80 w-64 overflow-y-auto">
        <MenuItem onClick={() => onCreate()}>
          <Plus />
          Blank card
        </MenuItem>
        <MenuSeparator />
        {templates.map((template) => (
          <MenuItem
            key={template.id}
            onClick={() => onCreate(cardDraftFromTemplate(template))}
          >
            <FileText />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{template.name}</span>
              {template.title ? (
                <span className="truncate text-xs text-muted-foreground">
                  {template.title}
                </span>
              ) : null}
            </span>
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onClick={requestTemplateManager}>
          <LayoutTemplate />
          Manage templates
        </MenuItem>
      </MenuContent>
    </Menu>
  ) : null

  if (appearance === "header" || !menu)
    return (
      <>
        {blank}
        {menu}
      </>
    )

  return (
    <div className="mb-3 flex w-full gap-1">
      {blank}
      {menu}
    </div>
  )
}
