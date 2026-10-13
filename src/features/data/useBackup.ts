import { useState } from 'react';
import { deliverFile } from '../../backup/deliver';
import { backupFileName, createBackup, serializeBackup } from '../../backup/format';
import { db } from '../../db';
import { setSetting } from '../../db/settings';
import { useToast } from '../../ui/toast';

/** Buat file backup lengkap lalu kirim/unduh. `lastBackupAt` hanya dicatat jika tidak dibatalkan. */
export function useBackup() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function runBackup(): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      const now = new Date();
      const backup = await createBackup(db, now);
      const result = await deliverFile(serializeBackup(backup), backupFileName(now), 'application/json');
      if (result === 'cancelled') return false;
      await setSetting(db, 'lastBackupAt', backup.exportedAt);
      await setSetting(db, 'backupBannerDismissedOn', null);
      toast({
        message: result === 'shared' ? 'Backup dibagikan' : 'File backup diunduh. Simpan di tempat yang aman.',
        duration: 5_000,
      });
      return true;
    } catch {
      toast({ message: 'Backup gagal dibuat. Coba lagi.', duration: 5_000 });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { runBackup, busy };
}
