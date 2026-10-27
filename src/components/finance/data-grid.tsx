"use client";
import { Select } from "@/components/ui/select";
import { tableExportFilename } from "@/lib/export/filenames";
import { Input } from "@/components/ui/input";

import { useId, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Search, ChevronLeft, ChevronRight, Download, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatToman,
  toToman,
  toPersianDigits as fa,
} from "@/lib/format/money";
import { EmptyState } from "@/components/finance/forms";
import {
  rowLimitOptions,
  useTablePageSize,
  type RowLimit,
} from "@/components/finance/use-table-page-size";

export function downloadCsv(
  name: string,
  columns: string[],
  rows: (string | number)[][],
) {
  const cell = (value: string | number) => {
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    [
      "\uFEFF" +
        [columns, ...rows].map((r) => r.map(cell).join(",")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = tableExportFilename(name);
  a.click();
  URL.revokeObjectURL(url);
}
export type GridColumn<T> = {
  key: keyof T & string;
  label: string;
  type?: "money" | "number" | "status";
};
export function DataGrid<T extends object>({
  data,
  columns: config,
  searchPlaceholder = "جست‌وجو...",
  renderAction,
  filename = "report",
  pageSize = 10,
  emptyTitle = "هنوز اطلاعاتی ثبت نشده",
  emptyDescription = "پس از ثبت اطلاعات، جزئیات در این بخش نمایش داده می‌شود.",
}: {
  data: T[];
  columns: GridColumn<T>[];
  searchPlaceholder?: string;
  renderAction?: (row: T) => React.ReactNode;
  filename?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowLimit, setRowLimit] = useTablePageSize(filename, pageSize);
  const [page, setPage] = useState({ rowLimit, index: 0 });
  const pageSizeId = useId();
  const showAll = rowLimit === "all";
  const currentPageSize = showAll ? Math.max(1, data.length) : rowLimit;
  // A restored preference or a change in another tab starts on the first page.
  const pageIndex = showAll || page.rowLimit !== rowLimit ? 0 : page.index;
  const columns = useMemo<ColumnDef<T>[]>(
    () =>
      config.map((c) => ({
        accessorKey: c.key,
        header: c.label,
        cell: ({ getValue }) => {
          const v = getValue();
          if (c.type === "money")
            return (
              <span className="whitespace-nowrap text-xs font-medium">
                {formatToman(Number(v || 0))}
              </span>
            );
          if (c.type === "number") return fa(String(v ?? "ثبت نشده"));
          if (c.type === "status") {
            const s = String(v);
            return (
              <span
                className={`status ${["تسویه‌شده", "تأییدشده", "مسکونی", "نهایی‌شده"].includes(s) ? "status-success" : ["بدهکار", "در انتظار بررسی", "پیش‌نویس", "سررسید گذشته", "پرداخت ناقص", "پرداخت‌نشده"].includes(s) ? "status-warning" : "status-neutral"}`}
              >
                {s === "تسویه‌شده" && (
                  <CircleCheck size={13} strokeWidth={2.25} aria-hidden="true" />
                )}
                {s}
              </span>
            );
          }
          return (
            <span className={c.key === config[0].key ? "font-medium" : ""}>
              {fa(String(v ?? "ثبت نشده"))}
            </span>
          );
        },
      })),
    [config],
  );
  // TanStack intentionally owns its memoization; React Compiler skips this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: search,
      sorting,
      pagination: { pageIndex, pageSize: currentPageSize },
    },
    onPaginationChange: (updater) => {
      setPage((previous) => {
        const old = {
          pageIndex:
            previous.rowLimit === rowLimit && !showAll ? previous.index : 0,
          pageSize: currentPageSize,
        };
        const next = typeof updater === "function" ? updater(old) : updater;
        return { rowLimit, index: next.pageIndex };
      });
    },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    globalFilterFn: (row, columnId, value) => {
      const normalize = (s: unknown) =>
        fa(String(s ?? ""))
          .replaceAll("ي", "ی")
          .replaceAll("ك", "ک")
          .toLocaleLowerCase("fa-IR");
      return normalize(row.getValue(columnId)).includes(normalize(value));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const count = table.getFilteredRowModel().rows.length;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <div className="relative min-w-0 flex-1 sm:max-w-[260px]">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            data-search-input=""
            aria-label={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              table.setPageIndex(0);
            }}
            placeholder={searchPlaceholder}
            className="w-full pe-3 ps-9 text-[11px]"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!count}
          onClick={() =>
            downloadCsv(
              filename,
              config.map((c) =>
                c.type === "money" ? `${c.label} (تومان)` : c.label,
              ),
              table
                .getFilteredRowModel()
                .rows.map((r) =>
                  config.map((c) =>
                    c.type === "money"
                      ? toToman(Number(r.original[c.key] || 0))
                      : String(r.original[c.key] ?? ""),
                  ),
                ),
            )
          }
        >
          <Download size={15} />
          خروجی CSV
        </Button>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-[11px]">
          <thead className="border-y border-border bg-muted/45 text-muted-foreground">
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th
                    key={h.id}
                    scope="col"
                    className="h-11 whitespace-nowrap px-5 font-normal"
                    aria-sort={
                      h.column.getIsSorted() === "asc"
                        ? "ascending"
                        : h.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === "asc" ? (
                        <ArrowUp size={11} />
                      ) : h.column.getIsSorted() === "desc" ? (
                        <ArrowDown size={11} />
                      ) : null}
                    </button>
                  </th>
                ))}
                {renderAction && <th className="px-5 font-normal">عملیات</th>}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="h-[66px] border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40"
              >
                {row.getVisibleCells().map((cell) => (
                  <td className="whitespace-nowrap px-5" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                {renderAction && (
                  <td className="px-5">{renderAction(row.original)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!count && (
        <EmptyState
          title={search ? "نتیجه‌ای پیدا نشد" : emptyTitle}
          description={
            search
              ? "عبارت جست‌وجو را تغییر دهید یا پاک کنید."
              : emptyDescription
          }
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3.5 text-[10px] text-muted-foreground">
        <span role="status" aria-live="polite" aria-atomic="true">
          {count
            ? `${fa(String(pageIndex * currentPageSize + 1))} تا ${fa(String(Math.min((pageIndex + 1) * currentPageSize, count)))} از ${fa(String(count))} مورد`
            : "۰ مورد"}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor={pageSizeId}>تعداد ردیف‌ها</label>
          <Select
            id={pageSizeId}
            value={rowLimit}
            onValueChange={(value) => {
              const next =
                value === "all" ? "all" : (Number(value) as RowLimit);
              setPage({ rowLimit: next, index: 0 });
              setRowLimit(next);
            }}
            className="w-auto min-w-20 text-[11px]"
          >
            {rowLimitOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "همه" : fa(String(option))}
              </option>
            ))}
          </Select>
        </div>
        {!showAll && table.getPageCount() > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={!table.getCanPreviousPage()}
              aria-label="صفحه قبل"
              className="rounded-md border border-border p-1.5 disabled:opacity-30"
              onClick={() => table.previousPage()}
            >
              <ChevronRight size={13} />
            </button>
            <span>
              صفحه {fa(String(pageIndex + 1))} از{" "}
              {fa(String(table.getPageCount()))}
            </span>
            <button
              disabled={!table.getCanNextPage()}
              aria-label="صفحه بعد"
              className="rounded-md border border-border p-1.5 disabled:opacity-30"
              onClick={() => table.nextPage()}
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
