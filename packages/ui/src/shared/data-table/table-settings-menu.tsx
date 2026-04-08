"use client";

import { Table2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { BsFiletypeCsv } from "react-icons/bs";
import { RiFileExcel2Line, RiFileMarkedLine } from "react-icons/ri";
import type { Model } from "../../types";
import type { DataTableColumn } from "./types";

type TableSettingsMenuProps<T extends Model> = {
  columns: DataTableColumn<T>[];
  hiddenColumns: Set<string>;
  onToggleColumn: (columnName: string) => void;
  data: T[];
  modelName: string;
  onClose: () => void;
};

const resolveExportValue = <T extends Model>(item: T, column: DataTableColumn<T>): string => {
  const raw = item[column.name];
  if (raw === null || raw === undefined) return "";
  if (
    column.property &&
    typeof raw === "object" &&
    column.property in (raw as Record<string, unknown>)
  ) {
    return String((raw as Record<string, unknown>)[column.property] ?? "");
  }
  if (typeof raw === "object") return "";
  return String(raw);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const exportToCsv = <T extends Model>(
  columns: DataTableColumn<T>[],
  data: T[],
  filename: string,
) => {
  const header = columns.map((col) => `"${col.label}"`).join(",");
  const rows = data.map((item) =>
    columns
      .map((col) => {
        const val = resolveExportValue(item, col);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(","),
  );
  const csv = [header, ...rows].join("\n");
  downloadBlob(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
};

const exportToMarkdown = <T extends Model>(
  columns: DataTableColumn<T>[],
  data: T[],
  filename: string,
) => {
  const header = `| ${columns.map((col) => col.label).join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const rows = data.map(
    (item) =>
      `| ${columns
        .map((col) => resolveExportValue(item, col).replace(/\|/g, "\\|"))
        .join(" | ")} |`,
  );
  const md = [header, separator, ...rows].join("\n");
  downloadBlob(new Blob([md], { type: "text/markdown" }), `${filename}.md`);
};

const exportToExcel = <T extends Model>(
  columns: DataTableColumn<T>[],
  data: T[],
  filename: string,
) => {
  const xmlEscape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const headerRow = columns
    .map((col) => `<Cell><Data ss:Type="String">${xmlEscape(col.label)}</Data></Cell>`)
    .join("");

  const dataRows = data
    .map(
      (item) =>
        `<Row>${columns
          .map(
            (col) =>
              `<Cell><Data ss:Type="String">${xmlEscape(resolveExportValue(item, col))}</Data></Cell>`,
          )
          .join("")}</Row>`,
    )
    .join("\n      ");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Sheet1">
    <Table>
      <Row>${headerRow}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  downloadBlob(new Blob([xml], { type: "application/vnd.ms-excel" }), `${filename}.xls`);
};

export const TableSettingsMenu = <T extends Model>({
  columns,
  hiddenColumns,
  onToggleColumn,
  data,
  modelName,
  onClose,
}: TableSettingsMenuProps<T>) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const visibleColumnsForExport = columns.filter((col) => !hiddenColumns.has(String(col.name)));

  return (
    <div
      ref={ref}
      className="absolute top-[calc(100%+6px)] right-0 z-50 w-64 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
    >
      {/* Columns section */}
      <div className="space-y-2 p-3">
        <div className="mb-2.5 flex items-center gap-1.5 font-semibold text-[10px] text-neutral-400 uppercase tracking-widest">
          <Table2 className="text-sm" />
          <span>Colunas</span>
        </div>
        <ul className="space-y-0.5">
          {columns.map((col) => {
            const key = String(col.name);
            const isVisible = !hiddenColumns.has(key);
            return (
              <li key={key}>
                <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-neutral-700 text-sm transition-colors hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggleColumn(key)}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded accent-blue-600"
                  />
                  <span className={isVisible ? "" : "text-neutral-400 line-through"}>
                    {col.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <hr className="mx-0 border-neutral-200" />

      {/* Export section */}
      <div className="space-y-2 p-3">
        <div className="mb-2.5 flex items-center gap-1.5 font-semibold text-[10px] text-neutral-400 uppercase tracking-widest">
          <span>Exportar</span>
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-neutral-700 text-sm transition-colors hover:bg-neutral-50"
            onClick={() => exportToExcel(visibleColumnsForExport, data ?? [], modelName)}
          >
            <RiFileExcel2Line className="text-base text-green-600" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-neutral-700 text-sm transition-colors hover:bg-neutral-50"
            onClick={() => exportToCsv(visibleColumnsForExport, data ?? [], modelName)}
          >
            <BsFiletypeCsv className="text-base text-blue-600" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-neutral-700 text-sm transition-colors hover:bg-neutral-50"
            onClick={() => exportToMarkdown(visibleColumnsForExport, data ?? [], modelName)}
          >
            <RiFileMarkedLine className="text-base text-neutral-600" />
            <span>Markdown</span>
          </button>
        </div>
      </div>
    </div>
  );
};
