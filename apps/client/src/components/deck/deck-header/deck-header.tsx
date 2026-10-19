import type { CardDraft, Column, DashboardView } from "@doska/core"
import { InvisibleInput } from "@doska/ui-kit"
import { AddCardControl } from "@/components/templates/add-card-control"
import { PageHeader } from "../../app/page-header"
import { BoardActionsMenu } from "./board-actions-menu"
import { SearchButton } from "./search-button"
import { RowViewButton } from "./row-view-button"
import { ShareButton } from "./share-button"
import { UserFilter } from "./user-filter"
import { VaultButton } from "./vault-button"
import { isDesktop } from "@/lib/platform"

interface IProps {
  boardId: string
  title: string
  columns: Column[]
  sort: string[]
  view: DashboardView
  onRename: (name: string) => void
  onDelete: () => void
  onReorderColumns: (changed: Column[]) => void
  onChangeSort: (sort: string[]) => void
  onChangeView: (view: DashboardView) => void
  onAddCard: (draft?: CardDraft) => void
  addCardDisabledReason?: string
}

export function DeckHeader({
  boardId,
  title,
  columns,
  sort,
  view,
  onRename,
  onDelete,
  onReorderColumns,
  onChangeSort,
  onChangeView,
  onAddCard,
  addCardDisabledReason,
}: IProps) {
  return (
    <PageHeader>
      <InvisibleInput
        value={title}
        onCommit={onRename}
        label="Board name"
        className="min-w-40 text-base font-semibold sm:min-w-68"
      />

      <div className="ml-auto flex items-center gap-1">
        <UserFilter boardId={boardId} />
        <AddCardControl
          appearance="header"
          label="Add card"
          menuLabel="Add card from template"
          disabledReason={addCardDisabledReason}
          onCreate={onAddCard}
        />
        <SearchButton boardId={boardId} />
        <RowViewButton view={view} onChangeView={onChangeView} />
        <ShareButton boardId={boardId} title={title} />
        {isDesktop() && <VaultButton boardId={boardId} />}
        <BoardActionsMenu
          boardId={boardId}
          title={title}
          columns={columns}
          sort={sort}
          onChangeSort={onChangeSort}
          onDelete={onDelete}
          onReorderColumns={onReorderColumns}
        />
      </div>
    </PageHeader>
  )
}
