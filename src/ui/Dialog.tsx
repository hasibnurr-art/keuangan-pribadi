import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './controls';
import { ICON, X } from './icons';

/**
 * Dialog berbasis <dialog> native (fokus terkunci, Esc menutup).
 * Di HP tampil sebagai bottom sheet; di layar lebar di tengah.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="mx-0 mt-auto mb-0 max-h-[90dvh] w-full max-w-none rounded-t-[28px] bg-surface p-0 text-slate-900 shadow-2xl open:animate-rise sm:m-auto sm:max-w-md sm:rounded-[28px]"
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-center justify-between px-5 pt-2 pb-1 sm:pt-4">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            <button
              type="button"
              aria-label="Tutup"
              className="-mr-2 flex size-11 items-center justify-center rounded-[14px] text-slate-500 hover:bg-slate-100 active:bg-slate-200"
              onClick={onClose}
            >
              <X size={ICON.md} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3">{children}</div>
          {footer && (
            <div className="flex gap-2 px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>
            Batal
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} block onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-700">{message}</div>
    </Dialog>
  );
}
