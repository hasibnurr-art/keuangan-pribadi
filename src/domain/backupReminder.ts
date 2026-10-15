// Status backup (PRD §9.12). Backup dilakukan mandiri dari Pengaturan / Backup & Data.

import { diffDays, localDate } from '../lib/date';
import type { LocalDate } from './types';

/** Hari sejak backup terakhir (berdasarkan tanggal lokal), null jika belum pernah. */
export function daysSinceBackup(lastBackupAt: string | null, today: LocalDate): number | null {
  if (!lastBackupAt) return null;
  return diffDays(localDate(new Date(lastBackupAt)), today);
}
