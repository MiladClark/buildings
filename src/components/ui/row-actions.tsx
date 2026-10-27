"use client";

import {
  cloneElement,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactElement,
} from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { Ellipsis, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "./button";
import { FormModal } from "@/components/finance/forms";
import { cn } from "@/lib/utils";

export type RowAction = {
  label: string;
  danger?: boolean;
  disabled?: boolean;
} & (
  | {
      href: string;
      dialog?: never;
      action?: never;
      confirm?: never;
      success?: never;
    }
  | {
      dialog: ReactElement<ComponentProps<typeof FormModal>>;
      href?: never;
      action?: never;
      confirm?: never;
      success?: never;
    }
  | {
      action: () => Promise<void>;
      confirm?: string;
      success?: string;
      href?: never;
      dialog?: never;
    }
);

function RowEditor({
  element,
  ...props
}: { element: ReactElement<ComponentProps<typeof FormModal>> } & Pick<
  ComponentProps<typeof FormModal>,
  "open" | "onOpenChange" | "onCloseAutoFocus"
>) {
  return cloneElement(element, { ...props, hideTrigger: true });
}

/** Dialogs stay outside the menu content, so closing the menu cannot unmount an editor. */
export function RowActions({
  label = "عملیات ردیف",
  items,
  initialDialog,
}: {
  label?: string;
  items: RowAction[];
  initialDialog?: number;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<number | null>(() => {
    const initial =
      initialDialog ??
      items.findIndex((item) => item.dialog?.props.initialOpen);
    return initial < 0 ? null : initial;
  });
  const [pending, start] = useTransition();
  const current = selected === null ? undefined : items[selected];
  const focusTrigger = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };
  const run = (item: RowAction) => {
    if (!item.action) return;
    start(async () => {
      try {
        await item.action!();
        toast.success(item.success ?? "عملیات با موفقیت انجام شد.");
        setSelected(null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "عملیات انجام نشد.",
        );
      }
    });
  };
  if (!items.length) return null;
  return (
    <>
      <Menu.Root dir="rtl" modal={false}>
        <Menu.Trigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label={label}
            className="size-10 shrink-0 p-0 data-[state=open]:bg-muted"
          >
            {pending ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : (
              <Ellipsis size={24} strokeWidth={2.5} />
            )}
          </Button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="end"
            sideOffset={6}
            collisionPadding={12}
            avoidCollisions
            updatePositionStrategy="always"
            hideWhenDetached
            onCloseAutoFocus={(event) => {
              if (selected !== null) event.preventDefault();
            }}
            className="motion-pop z-[80] min-w-44 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-xl border border-border bg-card p-1.5 text-foreground shadow-lg"
          >
            <Menu.Label className="max-w-72 truncate px-3 py-2 text-[11px] text-muted-foreground">
              {label}
            </Menu.Label>
            <Menu.Separator className="mb-1 h-px bg-border" />
            {items.map((item, index) => {
              const style = cn(
                "flex min-h-10 cursor-pointer select-none items-center rounded-lg px-3 py-2 text-xs outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                item.danger && "text-destructive",
              );
              return item.href ? (
                <Menu.Item
                  key={index}
                  asChild
                  disabled={item.disabled}
                  className={style}
                >
                  <Link href={item.href}>{item.label}</Link>
                </Menu.Item>
              ) : (
                <Menu.Item
                  key={index}
                  disabled={item.disabled || pending}
                  className={style}
                  onSelect={() => {
                    if (item.dialog || item.confirm) setSelected(index);
                    else run(item);
                  }}
                >
                  {item.label}
                </Menu.Item>
              );
            })}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      {items.map((item, index) =>
        item.dialog ? (
          <RowEditor
            key={index}
            element={item.dialog}
            open={selected === index}
            onOpenChange={(open) => setSelected(open ? index : null)}
            onCloseAutoFocus={focusTrigger}
          />
        ) : null,
      )}
      <Dialog.Root
        open={!!current?.confirm}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="motion-overlay fixed inset-0 z-[60] bg-black/35" />
          <Dialog.Content
            dir="rtl"
            onCloseAutoFocus={focusTrigger}
            onEscapeKeyDown={(event) => {
              if (pending) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (pending) event.preventDefault();
            }}
            className="motion-dialog fixed left-1/2 top-1/2 z-[70] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6"
          >
            <Dialog.Title className="text-lg font-bold">
              {current?.label}
            </Dialog.Title>
            <Dialog.Description className="my-5 text-sm leading-7 text-muted-foreground">
              {current?.confirm}
            </Dialog.Description>
            <div className="flex gap-3">
              <Button
                disabled={pending}
                variant={current?.danger ? "destructive" : "default"}
                onClick={() => current && run(current)}
              >
                {pending && <LoaderCircle size={16} className="animate-spin" />}
                تأیید و ادامه
              </Button>
              <Dialog.Close asChild>
                <Button disabled={pending} variant="outline">
                  انصراف
                </Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
