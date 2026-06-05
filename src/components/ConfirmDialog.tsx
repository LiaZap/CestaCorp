"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * ConfirmDialog — substitui window.confirm() (#62).
 *
 * Forma 1 (controlado): <ConfirmDialog open onOpenChange ... />
 * Forma 2 (imperativo): const confirm = useConfirm(); await confirm({...})
 */

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
};

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  variant = "default", onConfirm, loading,
}: ConfirmDialogProps) {
  const [busy, setBusy] = React.useState(false);
  const isBusy = loading ?? busy;

  async function handleConfirm() {
    try {
      setBusy(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
        >
          <div className="flex items-start gap-4">
            {variant === "destructive" && (
              <div className="h-10 w-10 shrink-0 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-base font-semibold leading-6 text-slate-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-2 text-sm text-slate-600">
                  {description}
                </Dialog.Description>
              )}
            </div>
          </div>
          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={isBusy}>{cancelLabel}</Button>
            </Dialog.Close>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={isBusy}
              className={cn(isBusy && "opacity-70")}
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* -------- Hook imperativo: useConfirm() -------- */

type ImperativeOptions = Omit<ConfirmDialogProps, "open" | "onOpenChange" | "onConfirm"> & {
  onConfirm?: () => void | Promise<void>;
};

type ConfirmFn = (opts: ImperativeOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{
    opts: ImperativeOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm: ConfirmFn = React.useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) {
              state.resolve(false);
              setState(null);
            }
          }}
          title={state.opts.title}
          description={state.opts.description}
          confirmLabel={state.opts.confirmLabel}
          cancelLabel={state.opts.cancelLabel}
          variant={state.opts.variant}
          onConfirm={async () => {
            await state.opts.onConfirm?.();
            state.resolve(true);
            setState(null);
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>");
  return ctx;
}
