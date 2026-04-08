import { Pencil, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import { Button } from "../../button";
import { useConfirmModal } from "../../hooks/use-confirmation-modal";
import { TableCell, TableRow } from "../../table";
import type { Model } from "../../types";
import type { DataItemProps, DataTableAction, DataTableColumn } from "./types";

export const DataItem = <T extends Model>({
  item,
  columns,
  actions,
  path,
  onDeleteAction,
}: DataItemProps<T>) => {
  const { confirm } = useConfirmModal();

  const resolveCellContent = (model: T, column: DataTableColumn<T>): React.ReactNode => {
    const output =
      column.property &&
      model[column.name] !== null &&
      column.property in (model[column.name] as Record<string, unknown>)
        ? String((model[column.name] as Record<string, unknown>)[column.property])
        : String(model[column.name] ?? "");

    return column.callback ? column.callback(model) : output;
  };

  const handleEditItem = (itemId: string) => {
    redirect(`/${path}/${itemId}/edit`);
  };

  const resolveAction = (item: T, action: DataTableAction<T>) => {
    if (typeof action === "function") {
      return action(item);
    }
    switch (action) {
      case "edit":
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleEditItem(item.id)}
            className="btn btn-secondary btn-sm btn-square"
          >
            <Pencil className="size-4" />
          </Button>
        );
      case "delete":
        return (
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={() =>
              confirm({
                title: "Excluir item",
                description:
                  "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.",
                confirmLabel: "Excluir",
                variant: "destructive",
                onConfirm: () => onDeleteAction?.(item.id),
              })
            }
            className="btn btn-sm btn-danger-reverse btn-square"
          >
            <Trash2 className="size-4" />
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <TableRow key={`table-row-model-${item.id}`}>
      {columns?.map((column, index) => (
        <TableCell key={`table-cel-model-${String(column.name)}-${index}`} className="first:pl-3">
          {resolveCellContent(item, column)}
        </TableCell>
      ))}
      <TableCell className="w-[1%] pr-3">
        <div className="flex gap-1">
          {actions?.map((action) => (
            <Fragment key={`action-${action}`}>{resolveAction(item, action)}</Fragment>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
};
