// Pembaruan versi (PRD §6.3): tidak memuat ulang otomatis agar form yang sedang diisi tidak hilang.

import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '../ui/toast';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  const toast = useToast();

  useEffect(() => {
    if (!offlineReady) return;
    toast({ message: 'Aplikasi siap dipakai tanpa internet', duration: 4_000 });
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, toast]);

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(0.5rem+env(safe-area-inset-top))]"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-brand-900 px-4 py-2.5 text-sm text-white shadow-lg">
        <span className="flex-1">Versi baru tersedia.</span>
        <button
          type="button"
          className="min-h-10 rounded-lg px-3 font-semibold text-brand-100 hover:bg-white/10"
          onClick={() => setNeedRefresh(false)}
        >
          Nanti
        </button>
        <button
          type="button"
          className="min-h-10 rounded-lg bg-white px-3 font-semibold text-brand-900"
          onClick={() => updateServiceWorker(true)}
        >
          Muat ulang
        </button>
      </div>
    </div>
  );
}
