// Pulihkan dari backup (PRD §9.12): pilih file → validasi → preview → konfirmasi → ganti semua data.
// Dipakai di halaman Backup & Data dan di onboarding (di luar DataProvider).

import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { restoreBackup } from '../../backup/restore';
import { parseBackup, type BackupSummary } from '../../backup/validate';
import type { BackupFile } from '../../backup/format';
import { db } from '../../db';
import { requestPersistentStorage } from '../../lib/platform';
import { formatDateTime, formatDisplayDate } from '../../lib/format';
import { Dialog } from '../../ui/Dialog';
import { Alert, Button } from '../../ui/controls';
import { useToast } from '../../ui/toast';
import { useBackup } from './useBackup';

const COUNT_LABEL: Array<[keyof BackupSummary['counts'], string]> = [
  ['accounts', 'Akun'],
  ['transactions', 'Transaksi'],
  ['categories', 'Kategori'],
  ['budgetLimits', 'Anggaran'],
  ['bills', 'Tagihan'],
];

export function RestorePanel({ onRestored, buttonLabel = 'Pilih file backup…' }: { onRestored?: () => void; buttonLabel?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const hasCurrentData = useLiveQuery(async () => (await db.accounts.count()) > 0, [], false);
  const { runBackup, busy } = useBackup();
  const toast = useToast();

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    const result = parseBackup(await file.text());
    if (input.current) input.current.value = '';
    if (!result.ok) setError(result.error);
    else setPending(result);
  }

  async function confirm() {
    if (!pending) return;
    setRestoring(true);
    try {
      await restoreBackup(db, pending.backup);
      await requestPersistentStorage();
      setPending(null);
      toast({ message: 'Data berhasil dipulihkan', duration: 5_000 });
      onRestored?.();
    } catch {
      setError('Pemulihan gagal. Data Anda sebelumnya tetap utuh; coba lagi.');
      setPending(null);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="File backup"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <Button variant="secondary" block onClick={() => input.current?.click()}>
        {buttonLabel}
      </Button>
      {error && <Alert>{error}</Alert>}

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Pulihkan data?"
        footer={
          <>
            <Button variant="secondary" block onClick={() => setPending(null)}>
              Batal
            </Button>
            <Button block disabled={restoring} onClick={confirm}>
              {restoring ? 'Memulihkan…' : 'Pulihkan'}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="flex flex-col gap-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">Dibuat</dt>
              <dd className="font-medium">{formatDateTime(pending.summary.exportedAt)}</dd>
              {COUNT_LABEL.map(([key, label]) => (
                <div key={key} className="contents">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium">{pending.summary.counts[key]}</dd>
                </div>
              ))}
              <dt className="text-slate-500">Rentang</dt>
              <dd className="font-medium">
                {pending.summary.firstDate && pending.summary.lastDate
                  ? `${formatDisplayDate(pending.summary.firstDate)} – ${formatDisplayDate(pending.summary.lastDate)}`
                  : 'Belum ada transaksi'}
              </dd>
              {pending.summary.accountNames.length > 0 && (
                <>
                  <dt className="text-slate-500">Akun aktif</dt>
                  <dd className="font-medium">{pending.summary.accountNames.join(', ')}</dd>
                </>
              )}
            </dl>
            {hasCurrentData && (
              <>
                <Alert tone="warning">
                  <strong>Semua data di perangkat ini akan DIGANTI</strong> dengan isi backup. Data yang belum di-backup akan
                  hilang.
                </Alert>
                <Button variant="secondary" disabled={busy} onClick={runBackup}>
                  {busy ? 'Membuat backup…' : 'Backup data saat ini dulu'}
                </Button>
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

