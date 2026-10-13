// Migrasi file backup lama ke skema terbaru (PRD §6.3, §9.12 langkah 6).
// Setiap kenaikan SCHEMA_VERSION WAJIB menambah entri di sini, fixture di
// src/test/fixtures/backup-v<N>.json, dan tes yang memulihkannya.

import { SCHEMA_VERSION } from '../db/schema';
import type { BackupFile } from './format';

type Migration = (backup: BackupFile) => BackupFile;

/** Kunci = versi asal; fungsi mengubah backup versi itu menjadi versi+1. */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: tabel target tabungan (goals) ditambahkan, awalnya kosong.
  1: (b) => ({ ...b, schemaVersion: 2, data: { ...b.data, goals: [] } }),
};

export function migrateBackup(backup: BackupFile): BackupFile {
  let current = backup;
  while (current.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];
    if (!step) throw new Error(`Tidak ada migrasi dari skema versi ${current.schemaVersion}.`);
    current = step(current);
  }
  return current;
}
