// Backup & Data (PRD §9.12–9.13): backup, pulihkan, ekspor CSV, hapus semua data.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/data';
import { transactionsToCsv } from '../../backup/csv';
import { deliverFile } from '../../backup/deliver';
import { wipeAllData } from '../../backup/restore';
import { daysSinceBackup } from '../../domain/backupReminder';
import { db } from '../../db';
import { Dialog } from '../../ui/Dialog';
import { Alert, Button, Card, Field, PageHeader, TextInput } from '../../ui/controls';
import { useToast } from '../../ui/toast';
import { formatDateTime } from '../../lib/format';
import { RestorePanel } from './RestorePanel';
import { useBackup } from './useBackup';

export function DataPage() {
  const { settings, today, transactions, accountsById, categoriesById } = useData();
  const { runBackup, busy } = useBackup();
  const navigate = useNavigate();
  const toast = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [wipeOpen, setWipeOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const days = daysSinceBackup(settings.lastBackupAt, today);
  const rangeInvalid = !!from && !!to && from > to;

  async function exportCsv() {
    const csv = transactionsToCsv(transactions, accountsById, categoriesById, {
      from: from || undefined,
      to: to || undefined,
    });
    const result = await deliverFile(csv, `keuangan-transaksi-${today}.csv`, 'text/csv');
    if (result !== 'cancelled') toast({ message: 'File CSV siap', duration: 4_000 });
  }

  async function wipe() {
    await wipeAllData(db);
    setWipeOpen(false);
    navigate('/', { replace: true });
  }

  return (
    <>
      <PageHeader title="Backup & Data" back />
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <h2 className="font-semibold">Backup</h2>
          <p className="mt-1 text-sm text-slate-600">
            {settings.lastBackupAt
              ? `Backup terakhir ${days === 0 ? 'hari ini' : `${days} hari lalu`} · ${formatDateTime(settings.lastBackupAt)}`
              : 'Anda belum pernah membuat backup.'}
          </p>
          <Button className="mt-3" block disabled={busy} onClick={runBackup}>
            {busy ? 'Membuat backup…' : 'Backup sekarang'}
          </Button>
          <p className="mt-2 text-xs text-slate-500">
            File backup berisi seluruh data keuangan Anda dan <strong>tidak dienkripsi</strong>. Simpan di tempat yang aman,
            misalnya Google Drive pribadi. Jangan kirim ke grup chat.
          </p>
        </Card>

        <Card>
          <h2 className="font-semibold">Pulihkan dari backup</h2>
          <p className="mt-1 mb-3 text-sm text-slate-600">
            Untuk pindah HP atau mengembalikan data. Semua data di perangkat ini akan diganti dengan isi file backup.
          </p>
          <RestorePanel onRestored={() => navigate('/', { replace: true })} />
        </Card>

        <Card>
          <h2 className="font-semibold">Ekspor CSV</h2>
          <p className="mt-1 mb-3 text-sm text-slate-600">
            Daftar transaksi untuk dibuka di Excel atau Google Sheets. CSV <strong>bukan</strong> backup dan tidak bisa dipulihkan.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari (opsional)">
              <TextInput type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Sampai (opsional)" error={rangeInvalid ? 'Harus setelah tanggal awal.' : undefined}>
              <TextInput type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Button className="mt-3" variant="secondary" block disabled={rangeInvalid || transactions.length === 0} onClick={exportCsv}>
            Ekspor CSV
          </Button>
        </Card>

        <Card>
          <h2 className="font-semibold text-red-800">Hapus semua data</h2>
          <p className="mt-1 mb-3 text-sm text-slate-600">
            Menghapus seluruh akun, transaksi, anggaran, dan tagihan dari perangkat ini. Tidak bisa dibatalkan.
          </p>
          <Button variant="danger" block onClick={() => setWipeOpen(true)}>
            Hapus semua data…
          </Button>
        </Card>
      </div>

      <Dialog
        open={wipeOpen}
        onClose={() => {
          setWipeOpen(false);
          setConfirmText('');
        }}
        title="Hapus semua data?"
        footer={
          <Button variant="danger" block disabled={confirmText.trim().toUpperCase() !== 'HAPUS'} onClick={wipe}>
            Hapus permanen
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <Alert tone="warning">Semua data di perangkat ini akan hilang permanen. Buat backup dulu jika masih dibutuhkan.</Alert>
          <Button variant="secondary" disabled={busy} onClick={runBackup}>
            Backup dulu
          </Button>
          <Field label='Ketik "HAPUS" untuk konfirmasi'>
            <TextInput value={confirmText} autoComplete="off" onChange={(e) => setConfirmText(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
