"use client";
import { createContext, useContext, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle, Plus, CircleCheck, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ModalCloseContext = createContext<(() => void) | null>(null);

export function ActionForm({
  action,
  children,
  className,
  success = "اطلاعات با موفقیت ذخیره شد.",
  onSuccess,
  closeOnSuccess = true,
}: {
  action: (form: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
  success?: string;
  onSuccess?: () => void;
  closeOnSuccess?: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const closeModal = useContext(ModalCloseContext);
  return (
    <form
      className="action-form min-w-0"
      action={(form) =>
        start(async () => {
          setMessage("");
          try {
            await action(form);
            toast.success(success);
            onSuccess?.();
            if (closeOnSuccess) closeModal?.();
          } catch (e) {
            const msg =
              e instanceof Error
                ? e.message
                : "ذخیره انجام نشد. دوباره تلاش کنید.";
            setMessage(msg);
            toast.error(msg);
          }
        })
      }
    >
      <fieldset
        disabled={pending}
        className={cn("action-form-fields", className)}
      >
        {children}
      </fieldset>
      {pending && (
        <p
          role="status"
          className="col-span-full flex items-center gap-2 text-xs text-muted-foreground"
        >
          <LoaderCircle size={15} className="animate-spin" />
          در حال ذخیره...
        </p>
      )}
      {message && (
        <p
          role="alert"
          className="col-span-full flex items-center gap-2 text-xs text-destructive"
        >
          <CircleAlert size={16} />
          {message}
        </p>
      )}
    </form>
  );
}
export function FormModal({
  title,
  description,
  trigger,
  children,
  initialOpen = false,
  onClose,
  contentClassName,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  onCloseAutoFocus,
}: {
  title: string;
  description: string;
  trigger?: React.ReactNode;
  children: React.ReactNode;
  initialOpen?: boolean;
  onClose?: () => void;
  contentClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [localOpen, setOpen] = useState(initialOpen);
  const open = controlledOpen ?? localOpen;
  const changeOpen = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
    if (!value) onClose?.();
  };
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      {!hideTrigger && (
        <Dialog.Trigger asChild>
          {trigger || (
            <Button>
              <Plus size={17} />
              {title}
            </Button>
          )}
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          dir="rtl"
          className={cn(
            "motion-dialog fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl",
            contentClassName,
          )}
        >
          <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
          <Dialog.Description className="mb-6 mt-2 pe-3 text-xs leading-6 text-muted-foreground">
            {description}
          </Dialog.Description>
          <Dialog.Close
            aria-label="بستن پنجره"
            className="absolute left-4 top-4 rounded-lg p-2 hover:bg-muted"
          >
            <X size={19} />
          </Dialog.Close>
          <ModalCloseContext.Provider value={() => changeOpen(false)}>
            {children}
          </ModalCloseContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ActionButton({
  action,
  children,
  variant = "outline",
  confirm,
  ariaLabel,
  success = "عملیات با موفقیت انجام شد.",
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  variant?: "outline" | "default" | "ghost" | "destructive";
  confirm?: string;
  ariaLabel?: string;
  success?: string;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const run = () =>
    start(async () => {
      try {
        await action();
        toast.success(success);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "عملیات انجام نشد.");
      }
    });
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        aria-label={ariaLabel}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {pending ? <LoaderCircle className="animate-spin" size={14} /> : null}
        {children}
      </Button>
      {confirm && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-black/35" />
            <Dialog.Content
              dir="rtl"
              className="motion-dialog fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6"
            >
              <Dialog.Title className="text-lg font-bold">
                تأیید عملیات
              </Dialog.Title>
              <Dialog.Description className="my-5 text-sm leading-7 text-muted-foreground">
                {confirm}
              </Dialog.Description>
              <div className="flex gap-3">
                <Button onClick={run} disabled={pending}>
                  تأیید و ادامه
                </Button>
                <Dialog.Close asChild>
                  <Button variant="outline">انصراف</Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="mb-3 rounded-xl bg-muted p-3 text-muted-foreground">
        <CircleCheck size={25} strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-4 mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
        {description}
      </p>
      {action}
    </div>
  );
}
