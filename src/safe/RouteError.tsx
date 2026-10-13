// Layar error yang ramah, menggantikan halaman error bawaan React Router.

import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { recordError, SAFE_MODE_URL } from './diagnostics';

export function RouteError() {
  const error = useRouteError();
  useEffect(() => recordError(error), [error]);
  const message = error instanceof Error ? error.message : String(error);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 text-sm">
      <h1 className="text-xl font-bold text-brand-900">Terjadi kesalahan</h1>
      <p className="text-slate-600">
        Aplikasi mengalami masalah saat menampilkan halaman ini. Data Anda tetap tersimpan di perangkat.
      </p>
      <p className="rounded-xl bg-slate-100 p-3 text-xs break-words text-slate-700">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 rounded-xl bg-brand-700 font-semibold text-white"
      >
        Muat ulang
      </button>
      <a href={SAFE_MODE_URL} className="min-h-11 rounded-xl border border-slate-300 bg-white py-3 text-center font-semibold">
        Buka Mode aman (selamatkan data)
      </a>
      <p className="text-xs text-slate-500">Jika masalah berulang, kirim tangkapan layar halaman ini.</p>
    </main>
  );
}
