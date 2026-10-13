// Kapan banner "Backup sekarang" tampil (PRD §9.12 Pengingat).

import { diffDays, localDate } from '../lib/date';
import type { LocalDate } from './types';

export interface ReminderInput {
  hasData: boolean;
  lastBackupAt: string | null;
  lastDataChangeAt: string | null;
  reminderDays: number;
  dismissedOn: LocalDate | null;
  today: LocalDate;
}

/** Hari sejak backup terakhir (berdasarkan tanggal lokal), null jika belum pernah. */
export function daysSinceBackup(lastBackupAt: string | null, today: LocalDate): number | null {
  if (!lastBackupAt) return null;
  return diffDays(localDate(new Date(lastBackupAt)), today);
}

export function shouldRemindBackup(input: ReminderInput): boolean {
  if (!input.hasData || input.dismissedOn === input.today) return false;
  if (!input.lastBackupAt) return true;
  const changedSince = !!input.lastDataChangeAt && input.lastDataChangeAt > input.lastBackupAt;
  const days = daysSinceBackup(input.lastBackupAt, input.today) ?? 0;
  return changedSince && days > input.reminderDays;
}
