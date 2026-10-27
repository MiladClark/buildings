"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; disabled: boolean };

function optionText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? optionText(child.props.children)
        : String(child),
    )
    .join("");
}

function collectOptions(children: ReactNode, groupDisabled = false): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment || child.type === "optgroup")
      return collectOptions(
        child.props.children,
        groupDisabled || !!child.props.disabled,
      );
    if (child.type !== "option") return [];
    const label = optionText(child.props.children);
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: groupDisabled || !!child.props.disabled,
      },
    ];
  });
}

type SelectProps = Pick<
  ComponentPropsWithoutRef<"select">,
  | "id"
  | "name"
  | "required"
  | "disabled"
  | "className"
  | "children"
  | "aria-label"
  | "aria-describedby"
  | "form"
  | "autoComplete"
  | "title"
> & {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  hideEmptyValue?: boolean;
};

/** A single RTL menu for forms and filters, retaining native FormData and validation. */
export function Select({
  id,
  name,
  required,
  disabled,
  className,
  children,
  value,
  defaultValue,
  onValueChange,
  onOpenChange,
  hideEmptyValue = false,
  form,
  autoComplete,
  title,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}: SelectProps) {
  const options = collectOptions(children);
  const initial = String(
    defaultValue ??
      options.find((option) => !option.disabled)?.value ??
      options[0]?.value ??
      "",
  );
  // Native selects initially retain a disabled empty placeholder, when present.
  const defaultSelection =
    defaultValue === undefined && options[0]?.value === "" ? "" : initial;
  const [localValue, setLocalValue] = useState(defaultSelection);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = value === undefined ? localValue : String(value);
  const selected =
    options.find((option) => option.value === current) ?? options[0];
  const actualValue = selected?.value ?? "";
  const changeValue = (next: string) => {
    if (value === undefined) setLocalValue(next);
    setInvalid(false);
    onValueChange?.(next);
  };
  useEffect(() => {
    const owner = native.current?.form;
    if (!owner) return;
    const reset = () => {
      if (value === undefined) setLocalValue(defaultSelection);
      setInvalid(false);
      setOpen(false);
    };
    owner.addEventListener("reset", reset);
    return () => owner.removeEventListener("reset", reset);
  }, [defaultSelection, value]);
  return (
    <>
      <select
        ref={native}
        name={name}
        form={form}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        value={actualValue}
        onChange={(event) => changeValue(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        data-native-select=""
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          setOpen(true);
        }}
      >
        {children}
      </select>
      <SelectPrimitive.Root
        dir="rtl"
        disabled={disabled || options.length === 0}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
        value={selected ? `option:${actualValue}` : ""}
        onValueChange={(next) => changeValue(next.slice(7))}
      >
        <SelectPrimitive.Trigger
          ref={trigger}
          id={id}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-required={required}
          aria-invalid={invalid || undefined}
          title={title}
          className={cn(
            "form-control inline-flex min-w-0 max-w-full items-center justify-between gap-3 text-start data-[state=open]:border-primary",
            className,
          )}
        >
          <SelectPrimitive.Value
            placeholder="انتخاب کنید"
            className="min-w-0 flex-1 truncate"
          >
            <span className="block min-w-0 truncate">
              {hideEmptyValue && actualValue === "" && !open
                ? ""
                : (selected?.label ?? "انتخاب کنید")}
            </span>
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
            <ChevronDown size={15} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            dir="rtl"
            position="popper"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="motion-pop select-menu z-[90] w-[var(--radix-select-trigger-width)] min-w-36 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-lg outline-none"
          >
            <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center bg-card text-muted-foreground">
              <ChevronUp size={14} />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="max-h-[min(320px,var(--radix-select-content-available-height))] p-1.5">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={`option:${option.value}`}
                  textValue={option.label}
                  disabled={option.disabled}
                  className="relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2 ps-3 pe-8 text-[13px] leading-6 outline-none data-[highlighted]:bg-secondary data-[state=checked]:font-medium data-[state=checked]:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute end-2.5 inline-flex items-center justify-center">
                    <Check size={15} strokeWidth={2.5} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center bg-card text-muted-foreground">
              <ChevronDown size={14} />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </>
  );
}
