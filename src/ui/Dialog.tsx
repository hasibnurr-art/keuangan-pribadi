import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './controls';

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
      className="mx-0 mt-auto mb-0 max-h-[90dvh] w-full max-w-none rounded-t-2xl bg-white p-0 text-slate-900 shadow-xl sm:m-auto sm:max-w-md sm:rounded-2xl"
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Tutup"
              className="flex size-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <div className="flex gap-2 border-t border-slate-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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
