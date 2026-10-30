import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const textButtonSize = "h-9 min-h-9 min-w-32 rounded-lg px-4 text-xs leading-5";

const buttonVariants = cva(
  "app-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border border-transparent font-medium transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-border bg-background hover:bg-muted text-foreground",
        ghost: "hover:bg-muted text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: textButtonSize,
        sm: textButtonSize,
        lg: textButtonSize,
        icon: "size-9 min-h-9 min-w-9 rounded-lg p-0 leading-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
