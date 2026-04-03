"use client";

import { ChevronLeft, ChevronRight, MoveDown, MoveUp, Search, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../button";
import usePagination from "../../hooks/use-pagination";
import { Input } from "../../input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../table";
import type { Model } from "../../types";
import { DataItem } from "./data-item";
import { EmptyData } from "./empty-data";
import { TableSettingsMenu } from "./table-settings-menu";
import type { DataTableProps } from "./types";

export const DataTable = <T extends Model>({
  data,
  totalPages,
  options: { path, columns, actions, modelName },
  onDeleteAction,
  fetchData,
}: DataTableProps<T>) => {
  const { pagination, setPage, setOrder } = usePagination();
  const [search, setSearch] = useState("");
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const settingsTriggerRef = useRef<HTMLDivElement>(null);

  const handleClearSearchField = () => setSearch("");

  const handleToggleSearchForm = () => {
    setShowSearchForm((value) => !value);
    handleClearSearchField();
  };

  const handleToggleColumn = (columnName: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnName)) {
        next.delete(columnName);
      } else {
        next.add(columnName);
      }
      return next;
    });
  };

  useEffect(() => {
    fetchData(pagination.page, pagination.size, pagination.order);
  }, [fetchData, pagination.page, pagination.size, pagination.order]);

  const visibleColumns = columns?.filter((col) => !hiddenColumns.has(String(col.name))) ?? [];

  return (
    <div className="flex h-full flex-1 flex-col space-y-3 bg-white">
      <div className="flex-1">
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          {/* Toolbar */}
          <div className="flex w-full items-center justify-between gap-3 border-neutral-200 border-b px-3 py-3">
            <div>&nbsp;</div>
            <div className="flex h-[34px] flex-1 items-center justify-end gap-3">
              {showSearchForm ? (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Input
                    placeholder="Buscar"
                    className="h-8"
                    name="search"
                    autoComplete="off"
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                  />
                  <Button variant="outline" size="sm" onClick={handleToggleSearchForm}>
                    Remover
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="icon-sm" onClick={handleToggleSearchForm}>
                  <Search className="h-4 w-4" />
                </Button>
              )}
              <div ref={settingsTriggerRef} className="relative">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setShowSettings((v) => !v)}
                  aria-label="Configurações da tabela"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                {showSettings && columns && (
                  <TableSettingsMenu
                    columns={columns}
                    hiddenColumns={hiddenColumns}
                    onToggleColumn={handleToggleColumn}
                    data={data ?? []}
                    modelName={modelName}
                    onClose={() => setShowSettings(false)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          {!data?.length ? (
            <EmptyData />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="cursor-pointer bg-neutral-50 hover:bg-neutral-50">
                  {visibleColumns.map((column, index) => (
                    <TableHead
                      key={`table-head-${String(column.name)}-${index}`}
                      className="first:pl-3 last:pr-3"
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setOrder(String(column.name))}
                        aria-label={`Sort by ${column.label} ${pagination.order.field === column.name ? (pagination.order.isAscendent ? "descending" : "ascending") : "ascending"}`}
                      >
                        <div className="flex items-center gap-2 font-medium text-neutral-400 text-xs uppercase">
                          <span>{column.label}</span>
                          <span>
                            {pagination.order.field === column.name ? (
                              pagination.order.isAscendent ? (
                                <MoveUp className="h-3 w-3" />
                              ) : (
                                <MoveDown className="h-3 w-3" />
                              )
                            ) : null}
                          </span>
                        </div>
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="pr-3">&nbsp;</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <DataItem
                    item={item}
                    columns={visibleColumns}
                    actions={actions}
                    path={path}
                    onDeleteAction={onDeleteAction}
                    key={`table-row-model-${item.id}-${index}`}
                  />
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-neutral-200 border-t px-3 py-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage(pagination.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-neutral-500 text-xs">
                {pagination.page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={pagination.page >= totalPages}
                onClick={() => setPage(pagination.page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
