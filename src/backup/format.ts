// Format file backup (PRD §9.12). File berisi SELURUH data perangkat.

import type { Account, Bill, BillSkip, BudgetLimit, Category, Goal, Setting, Transaction } from '../domain/types';
import { SCHEMA_VERSION, type KeuanganDB } from '../db/schema';

export const BACKUP_APP_ID = 'keuangan-pribadi';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgetLimits: BudgetLimit[];
  bills: Bill[];
  billSkips: BillSkip[];
  settings: Setting[];
  goals: Goal[];
}

export type BackupCounts = { [K in keyof BackupData]: number };

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  counts: BackupCounts;
  data: BackupData;
}

export const BACKUP_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgetLimits',
  'bills',
  'billSkips',
  'settings',
  'goals',
] as const satisfies ReadonlyArray<keyof BackupData>;

export function countsOf(data: BackupData): BackupCounts {
  return Object.fromEntries(BACKUP_TABLES.map((t) => [t, data[t].length])) as BackupCounts;
}

/** Ambil seluruh data dalam satu transaksi baca agar snapshot konsisten. */
export async function createBackup(db: KeuanganDB, now: Date = new Date()): Promise<BackupFile> {
  const data = await db.transaction('r', BACKUP_TABLES.map((t) => db[t]), async () => {
    const [accounts, categories, transactions, budgetLimits, bills, billSkips, settings, goals] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgetLimits.toArray(),
      db.bills.toArray(),
      db.billSkips.toArray(),
      db.settings.toArray(),
      db.goals.toArray(),
    ]);
    return { accounts, categories, transactions, budgetLimits, bills, billSkips, settings, goals };
  });
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    counts: countsOf(data),
    data,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `keuangan-backup-2026-10-13-2130.json` (waktu lokal). */
export function backupFileName(now: Date = new Date()): string {
  return `keuangan-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup);
}
