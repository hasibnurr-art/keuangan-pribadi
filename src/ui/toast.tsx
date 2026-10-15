import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export const UNDO_DURATION_MS = 8_000;

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: ++counter.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.duration ?? UNDO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-md animate-rise items-center gap-3 rounded-2xl bg-inverse py-2 pr-2 pl-4 text-sm font-medium text-on-inverse shadow-xl"
          >
            <span className="flex-1">{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="min-h-11 rounded-[14px] px-3 font-bold text-inverse-accent hover:bg-white/10"
                onClick={async () => {
                  setToast(null);
                  await toast.onAction!();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  return use(ToastContext);
}
