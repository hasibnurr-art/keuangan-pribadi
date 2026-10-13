import { useData } from '../../app/data';
import { daysSinceBackup, shouldRemindBackup } from '../../domain/backupReminder';
import { db } from '../../db';
import { setSetting } from '../../db/settings';
import { useBackup } from './useBackup';
import { FloppyDisk, ICON, X } from '../../ui/icons';

/** Banner pengingat backup di Beranda (PRD §9.12). Ditutup → muncul lagi besok. */
export function BackupBanner() {
  const { settings, transactions, today } = useData();
  const { runBackup, busy } = useBackup();
  const show = shouldRemindBackup({
    hasData: transactions.length > 0,
    lastBackupAt: settings.lastBackupAt,
    lastDataChangeAt: settings.lastDataChangeAt,
    reminderDays: settings.backupReminderDays,
    dismissedOn: settings.backupBannerDismissedOn,
    today,
  });
  if (!show) return null;

  const days = daysSinceBackup(settings.lastBackupAt, today);
  return (
    <section
      aria-label="Pengingat backup"
      className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <FloppyDisk size={ICON.lg} className="shrink-0 text-amber-900" />
      <div className="flex-1">
        <p className="font-semibold">{days === null ? 'Anda belum pernah backup' : `Backup terakhir ${days} hari lalu`}</p>
        <p className="mt-0.5">Data hanya ada di perangkat ini. Simpan salinannya agar tidak hilang.</p>
        <button
          type="button"
          disabled={busy}
          onClick={runBackup}
          className="mt-2 min-h-11 whitespace-nowrap rounded-xl bg-amber-900 px-4 font-semibold text-white hover:bg-amber-950 active:bg-black disabled:opacity-60"
        >
          {busy ? 'Membuat backup…' : 'Backup sekarang'}
        </button>
      </div>
      <button
        type="button"
        aria-label="Tutup pengingat untuk hari ini"
        className="flex size-11 items-center justify-center rounded-full text-amber-900 hover:bg-amber-100 active:bg-amber-200"
        onClick={() => setSetting(db, 'backupBannerDismissedOn', today)}
      >
        <X size={ICON.md} />
      </button>
    </section>
  );
}
