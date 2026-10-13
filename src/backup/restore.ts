// Restore (PRD §9.12): mengganti SELURUH data dalam satu transaksi database.
// Jika apa pun gagal di tengah jalan, Dexie membatalkan semuanya dan data lama tetap utuh.

import type { KeuanganDB } from '../db/schema';
import { BACKUP_TABLES, type BackupFile } from './format';

export interface RestoreHooks {
  /** Hanya untuk tes: dipanggil setelah tabel dikosongkan, sebelum diisi. */
  afterClear?: () => void | Promise<void>;
}

export async function restoreBackup(db: KeuanganDB, backup: BackupFile, hooks: RestoreHooks = {}): Promise<void> {
  await db.transaction('rw', BACKUP_TABLES.map((t) => db[t]), async () => {
    for (const table of BACKUP_TABLES) await db[table].clear();
    await hooks.afterClear?.();

    await db.accounts.bulkAdd(backup.data.accounts);
    await db.categories.bulkAdd(backup.data.categories);
    await db.transactions.bulkAdd(backup.data.transactions);
    await db.budgetLimits.bulkAdd(backup.data.budgetLimits);
    await db.bills.bulkAdd(backup.data.bills);
    await db.billSkips.bulkAdd(backup.data.billSkips);
    await db.settings.bulkAdd(backup.data.settings);

    // Data sekarang identik dengan isi backup; aplikasi langsung siap dipakai.
    await db.settings.bulkPut([
      { key: 'onboardingDone', value: true },
      { key: 'lastBackupAt', value: backup.exportedAt },
      { key: 'lastDataChangeAt', value: backup.exportedAt },
      { key: 'backupBannerDismissedOn', value: null },
    ]);
  });
}

/** Hapus semua data (konfirmasi `HAPUS` di UI). Aplikasi kembali ke onboarding. */
export async function wipeAllData(db: KeuanganDB): Promise<void> {
  await db.transaction('rw', BACKUP_TABLES.map((t) => db[t]), async () => {
    for (const table of BACKUP_TABLES) await db[table].clear();
  });
}
