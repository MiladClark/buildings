"use client";

import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import "./search-input.css";

/** One search control for tables, account lists and mobile cards. */
export function SearchInput({
  label = "جست‌وجو",
  placeholder = " ",
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "label"> & { label?: string }) {
  return (
    <div className={cn("search-field", className)}>
      <Search className="search-field-icon" aria-hidden="true" />
      <Input
        {...props}
        type="search"
        label="جست‌وجو"
        aria-label={props["aria-label"] ?? label}
        autoComplete={props.autoComplete ?? "off"}
        placeholder={placeholder}
        data-search-input=""
      />
    </div>
  );
}
