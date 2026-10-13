// Mode aman (?aman=1): tanpa perhitungan dashboard, tanpa router. Tujuannya menyelamatkan
// data (unduh backup) dan menonaktifkan tagihan yang mungkin bermasalah.

import { useEffect, useState } from 'react';
import { deliverFile } from '../backup/deliver';
import { BACKUP_TABLES, backupFileName, createBackup, serializeBackup } from '../backup/format';
import { db } from '../db';
import type { Bill } from '../domain/types';
import { lastRecordedError } from './diagnostics';

type Counts = Record<(typeof BACKUP_TABLES)[number], number>;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Database tidak merespons.')), ms)),
  ]);
}

export function SafeMode() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const lastError = lastRecordedError();

  async function load() {
    try {
      const entries = await withTimeout(
        Promise.all(BACKUP_TABLES.map(async (t) => [t, await db[t].count()] as const)),
        8_000,
      );
      setCounts(Object.fromEntries(entries) as Counts);
      setBills(await withTimeout(db.bills.toArray(), 8_000));
      setDbError(null);
    } catch (e) {
      setDbError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function backup() {
    setStatus('Membuat backup…');
    try {
      const now = new Date();
      const file = await withTimeout(createBackup(db, now), 15_000);
      const result = await deliverFile(serializeBackup(file), backupFileName(now), 'application/json');
      if (result !== 'cancelled') await db.settings.put({ key: 'lastBackupAt', value: file.exportedAt });
      setStatus(result === 'cancelled' ? null : 'Backup berhasil dibuat. Simpan file tersebut.');
    } catch (e) {
      setStatus(`Backup gagal: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function toggleBill(bill: Bill) {
    await db.bills.put({ ...bill, active: !bill.active });
    await load();
  }

  const box = 'rounded-2xl border border-slate-200 bg-white p-4';
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8 text-sm">
      <div>
        <h1 className="text-xl font-bold text-brand-900">Mode aman</h1>
        <p className="mt-1 text-slate-600">
          Mode ini hanya membaca data tanpa menghitung dashboard. Gunakan untuk menyelamatkan data jika aplikasi macet.
        </p>
      </div>

      <section className={box}>
        <h2 className="mb-2 font-semibold">1. Selamatkan data</h2>
        <button type="button" onClick={backup} className="min-h-11 w-full rounded-xl bg-brand-700 font-semibold text-white">
          Unduh backup
        </button>
        {status && <p className="mt-2 text-slate-700">{status}</p>}
      </section>

      <section className={box}>
        <h2 className="mb-2 font-semibold">Isi data di perangkat ini</h2>
        {dbError ? (
          <p className="text-red-700">{dbError} Tutup aplikasi sepenuhnya, lalu buka lagi halaman ini.</p>
        ) : counts ? (
          <p className="text-slate-700">
            {counts.accounts} akun · {counts.transactions} transaksi · {counts.bills} tagihan · {counts.budgetLimits} anggaran
          </p>
        ) : (
          <p className="text-slate-500">Membaca…</p>
        )}
      </section>

      {bills.length > 0 && (
        <section className={box}>
          <h2 className="mb-1 font-semibold">2. Tagihan</h2>
          <p className="mb-3 text-slate-600">Jika aplikasi macet setelah menambah tagihan, nonaktifkan tagihan terakhir lalu buka aplikasi lagi.</p>
          <ul className="divide-y divide-slate-100">
            {bills.map((b) => (
              <li key={b.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {b.name} {!b.active && <span className="text-xs text-slate-500">(nonaktif)</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    Rp{b.amount.toLocaleString('id-ID')} · tgl {b.dueDay} · mulai {b.startMonth}
                    {b.endMonth ? ` s.d. ${b.endMonth}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => toggleBill(b)} className="min-h-11 rounded-lg border border-slate-300 px-3 font-semibold">
                  {b.active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lastError && (
        <section className={box}>
          <h2 className="mb-1 font-semibold">Info teknis</h2>
          <p className="break-words text-xs text-slate-600">
            {lastError.message}
            <br />
            versi {lastError.version} · {new Date(lastError.at).toLocaleString('id-ID')}
          </p>
        </section>
      )}

      <a href="./" className="min-h-11 rounded-xl border border-slate-300 bg-white py-3 text-center font-semibold">
        Kembali ke aplikasi
      </a>
      <p className="text-center text-xs text-slate-500">Versi {__APP_VERSION__}</p>
    </main>
  );
}
