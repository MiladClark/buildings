"use client";
import { Select } from "@/components/ui/select";
import { tableExportFilename } from "@/lib/export/filenames";
import { SearchInput } from "@/components/ui/search-input";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

import { useId, useMemo, useRef, useState } from "react";
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
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  CircleCheck,
  ArrowDownUp,
} from "lucide-react";
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
type MobileGridConfig<T> = {
  title: keyof T & string;
  subtitle?: keyof T & string;
  status?: keyof T & string;
  amount?: keyof T & string;
  details: (keyof T & string)[];
};

function gridValue<T>(column: GridColumn<T>, value: unknown, mobile = false) {
  if (mobile && (value === null || value === undefined || value === ""))
    return "—";
  if (column.type === "money")
    return (
      <span
        className={cn(
          "font-medium tabular-nums",
          mobile ? "break-words text-sm" : "whitespace-nowrap text-xs",
        )}
      >
        {formatToman(Number(value || 0))}
      </span>
    );
  if (column.type === "number") return fa(String(value ?? "ثبت نشده"));
  if (column.type === "status") {
    const status = String(value);
    return (
      <span
        className={`status ${["تسویه‌شده", "تأییدشده", "مسکونی", "نهایی‌شده", "انجام‌شده"].includes(status) ? "status-success" : ["بدهکار", "در انتظار بررسی", "پیش‌نویس", "سررسید گذشته", "پرداخت ناقص", "پرداخت‌نشده", "در انتظار رسیدگی"].includes(status) ? "status-warning" : "status-neutral"}`}
      >
        {status === "تسویه‌شده" && (
          <CircleCheck size={13} strokeWidth={2.25} aria-hidden="true" />
        )}
        {status}
      </span>
    );
  }
  return fa(String(value ?? "ثبت نشده"));
}
export function DataGrid<T extends object>({
  data,
  columns: config,
  searchPlaceholder = "جست‌وجو...",
  renderAction,
  filename = "report",
  pageSize = 10,
  emptyTitle = "هنوز اطلاعاتی ثبت نشده",
  emptyDescription = "پس از ثبت اطلاعات، جزئیات در این بخش نمایش داده می‌شود.",
  mobile,
  renderMobileAction,
}: {
  data: T[];
  columns: GridColumn<T>[];
  searchPlaceholder?: string;
  renderAction?: (row: T) => React.ReactNode;
  filename?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  mobile?: MobileGridConfig<T>;
  renderMobileAction?: (row: T) => React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowLimit, setRowLimit] = useTablePageSize(filename, pageSize);
  const [page, setPage] = useState({ rowLimit, index: 0 });
  const pageSizeId = useId();
  const mobileList = useRef<HTMLUListElement>(null);
  const scrollToCards = () => {
    if (mobile && window.matchMedia("(max-width: 639px)").matches)
      mobileList.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
  };
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
          return (
            <span className={c.key === config[0].key ? "font-medium" : ""}>
              {gridValue(c, getValue())}
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
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 px-5 pb-4",
          mobile &&
            "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_36px_36px] max-sm:gap-2 max-sm:px-4",
        )}
      >
        <SearchInput
          label={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            table.setPageIndex(0);
          }}
        />
        {mobile && (
          <DropdownMenu.Root dir="rtl">
            <DropdownMenu.Trigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="sm:hidden"
                aria-label="مرتب‌سازی فهرست"
                title="مرتب‌سازی"
              >
                <ArrowDownUp aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                collisionPadding={12}
                className="z-[80] max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] min-w-48 max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-border bg-card p-1.5 text-xs shadow-lg"
              >
                <DropdownMenu.Label className="px-3 py-2 text-muted-foreground">
                  مرتب‌سازی بر اساس
                </DropdownMenu.Label>
                <DropdownMenu.RadioGroup
                  value={
                    sorting[0]
                      ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
                      : "default"
                  }
                  onValueChange={(value) => {
                    const index = value.lastIndexOf(":");
                    setSorting(
                      value === "default"
                        ? []
                        : [
                            {
                              id: value.slice(0, index),
                              desc: value.slice(index + 1) === "desc",
                            },
                          ],
                    );
                    table.setPageIndex(0);
                  }}
                >
                  {[
                    { value: "default", label: "ترتیب پیش‌فرض" },
                    ...config.flatMap((column) => [
                      {
                        value: `${column.key}:asc`,
                        label: `${column.label}؛ صعودی`,
                      },
                      {
                        value: `${column.key}:desc`,
                        label: `${column.label}؛ نزولی`,
                      },
                    ]),
                  ].map((option) => (
                    <DropdownMenu.RadioItem
                      key={option.value}
                      value={option.value}
                      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-muted"
                    >
                      {option.label}
                      <DropdownMenu.ItemIndicator>
                        <CircleCheck className="size-4 text-primary" />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={!count}
          aria-label="دریافت خروجی CSV"
          title="دریافت خروجی CSV"
          className={
            mobile ? "max-sm:size-9 max-sm:min-w-9 max-sm:p-0" : undefined
          }
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
          <span className={mobile ? "hidden sm:inline" : undefined}>
            خروجی CSV
          </span>
        </Button>
      </div>
      {mobile && count > 0 && (
        <ul
          ref={mobileList}
          aria-label="نمای کارتی اطلاعات"
          className="scroll-mt-[calc(5rem+env(safe-area-inset-top))] divide-y divide-border border-t border-border sm:hidden"
        >
          {table.getRowModel().rows.map((row) => {
            const item = row.original;
            const columnFor = (key: keyof T & string) =>
              config.find((column) => column.key === key);
            const statusColumn = mobile.status && columnFor(mobile.status);
            const amountColumn = mobile.amount && columnFor(mobile.amount);
            const fields = mobile.details.flatMap((key) => {
              const column = columnFor(key);
              return column ? [{ column, value: item[key] }] : [];
            });
            const actions = renderMobileAction
              ? renderMobileAction(item)
              : renderAction?.(item);
            return (
              <li key={row.id} className="min-w-0 space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold leading-6">
                      {fa(String(item[mobile.title] ?? "ثبت نشده"))}
                    </h3>
                    {mobile.subtitle && (
                      <p className="mt-1 break-words text-xs leading-6 text-muted-foreground">
                        {fa(String(item[mobile.subtitle] ?? ""))}
                      </p>
                    )}
                  </div>
                  {statusColumn &&
                    gridValue(statusColumn, item[statusColumn.key], true)}
                </div>
                {amountColumn && (
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {amountColumn.label}
                    </span>
                    <p className="min-w-0 break-words text-lg font-semibold tabular-nums">
                      {amountColumn.type === "money"
                        ? formatToman(Number(item[amountColumn.key] || 0))
                        : fa(String(item[amountColumn.key] ?? "ثبت نشده"))}
                    </p>
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {fields.map(({ column, value }, index) => (
                    <div
                      key={column.key}
                      className={cn(
                        "min-w-0",
                        fields.length % 2 !== 0 &&
                          index === fields.length - 1 &&
                          "col-span-2",
                      )}
                    >
                      <dt className="text-[11px] text-muted-foreground">
                        {column.label}
                      </dt>
                      <dd className="mt-1 break-words text-xs leading-6">
                        {gridValue(column, value, true)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {actions && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-3">
                    {actions}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div
        className={cn("w-full overflow-x-auto", mobile && "hidden sm:block")}
      >
        <table className="w-full min-w-[560px] text-right text-xs">
          <thead className="border-y border-border/70 text-muted-foreground">
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th
                    key={h.id}
                    scope="col"
                    className="h-12 whitespace-nowrap px-5 font-medium"
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
                className="h-16 border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    className="whitespace-nowrap px-5 py-3 align-middle"
                    key={cell.id}
                  >
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
          <span className={mobile ? "hidden sm:inline" : undefined}>
            {count
              ? `${fa(String(pageIndex * currentPageSize + 1))} تا ${fa(String(Math.min((pageIndex + 1) * currentPageSize, count)))} از ${fa(String(count))} مورد`
              : "۰ مورد"}
          </span>
          {mobile && (
            <span className="sm:hidden">{fa(String(count))} مورد</span>
          )}
        </span>
        <div
          className={cn(
            "flex items-center gap-2",
            mobile && count <= pageSize && "max-sm:hidden",
          )}
        >
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
              className={cn(
                "rounded-md border border-border p-1.5 disabled:opacity-30",
                mobile &&
                  "max-sm:flex max-sm:size-9 max-sm:items-center max-sm:justify-center",
              )}
              onClick={() => {
                table.previousPage();
                scrollToCards();
              }}
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
              className={cn(
                "rounded-md border border-border p-1.5 disabled:opacity-30",
                mobile &&
                  "max-sm:flex max-sm:size-9 max-sm:items-center max-sm:justify-center",
              )}
              onClick={() => {
                table.nextPage();
                scrollToCards();
              }}
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
