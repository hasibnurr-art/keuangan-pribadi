// Validasi ketat file backup sebelum restore (PRD §9.12 langkah 2).
// File dari luar dianggap tidak tepercaya: setiap record diperiksa tipe dan rujukannya.

import { isValidLocalDate, isValidYearMonth } from '../lib/date';
import { MAX_AMOUNT, type LocalDate } from '../domain/types';
import { SCHEMA_VERSION } from '../db/schema';
import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION, BACKUP_TABLES, countsOf, type BackupCounts, type BackupFile } from './format';
import { migrateBackup } from './migrate';

export interface BackupSummary {
  exportedAt: string;
  counts: BackupCounts;
  /** Rentang tanggal transaksi, null jika tidak ada transaksi. */
  firstDate: LocalDate | null;
  lastDate: LocalDate | null;
  accountNames: string[];
}

export type ParseResult =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; error: string };

class BackupError extends Error {}

type Rec = Record<string, unknown>;

const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isInt = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isBool = (v: unknown) => typeof v === 'boolean';
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
const oneOf = (values: readonly string[]) => (v: unknown) => typeof v === 'string' && values.includes(v);

const LABEL: Record<(typeof BACKUP_TABLES)[number], string> = {
  accounts: 'akun',
  categories: 'kategori',
  transactions: 'transaksi',
  budgetLimits: 'anggaran',
  bills: 'tagihan',
  billSkips: 'tagihan dilewati',
  settings: 'pengaturan',
  goals: 'target',
};

function fail(table: (typeof BACKUP_TABLES)[number], index: number, problem: string): never {
  throw new BackupError(`File backup rusak: ${LABEL[table]} ke-${index + 1} ${problem}.`);
}

function check(table: (typeof BACKUP_TABLES)[number], index: number, ok: boolean, problem: string) {
  if (!ok) fail(table, index, problem);
}

function validateData(data: Rec): void {
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(data[table])) throw new BackupError(`File backup tidak lengkap: bagian ${LABEL[table]} tidak ada.`);
  }
  const rows = (t: (typeof BACKUP_TABLES)[number]) => data[t] as unknown[];

  const ids = (t: (typeof BACKUP_TABLES)[number]) => {
    const set = new Set<string>();
    rows(t).forEach((r, i) => {
      check(t, i, isObj(r) && isStr(r.id), 'tidak punya ID');
      check(t, i, !set.has((r as Rec).id as string), 'memakai ID ganda');
      set.add((r as Rec).id as string);
    });
    return set;
  };

  const accountIds = ids('accounts');
  const categoryIds = ids('categories');
  const billIds = ids('bills');
  ids('transactions');
  ids('budgetLimits');
  ids('goals');

  rows('accounts').forEach((r, i) => {
    const a = r as Rec;
    check('accounts', i, isStr(a.name), 'tidak punya nama');
    check('accounts', i, oneOf(['asset', 'liability'])(a.group), 'punya kelompok tidak dikenal');
    check('accounts', i, oneOf(['cash', 'bank', 'ewallet', 'other_asset', 'credit_card', 'paylater', 'loan', 'other_liability'])(a.kind), 'punya jenis tidak dikenal');
    check('accounts', i, isInt(a.openingBalance, 0, MAX_AMOUNT), 'punya saldo awal tidak valid');
    check('accounts', i, typeof a.openingDate === 'string' && isValidLocalDate(a.openingDate), 'punya tanggal saldo awal tidak valid');
    check('accounts', i, isBool(a.includeInAvailable) && isBool(a.archived) && typeof a.sortOrder === 'number', 'punya data tidak lengkap');
  });

  rows('categories').forEach((r, i) => {
    const c = r as Rec;
    check('categories', i, isStr(c.name) && oneOf(['income', 'expense'])(c.type), 'punya nama/jenis tidak valid');
    check('categories', i, typeof c.icon === 'string' && typeof c.color === 'string' && isBool(c.archived) && typeof c.sortOrder === 'number', 'punya data tidak lengkap');
  });

  rows('bills').forEach((r, i) => {
    const b = r as Rec;
    check('bills', i, isStr(b.name) && oneOf(['expense', 'transfer'])(b.kind), 'punya nama/jenis tidak valid');
    check('bills', i, isInt(b.amount, 1, MAX_AMOUNT) && isInt(b.dueDay, 1, 31) && isBool(b.isVariable) && isBool(b.active), 'punya nominal/tanggal tidak valid');
    check('bills', i, accountIds.has(b.accountId as string), 'merujuk akun yang tidak ada');
    check('bills', i, optional(b.toAccountId, (v) => accountIds.has(v as string)), 'merujuk akun tujuan yang tidak ada');
    check('bills', i, optional(b.categoryId, (v) => categoryIds.has(v as string)), 'merujuk kategori yang tidak ada');
    check('bills', i, typeof b.startMonth === 'string' && isValidYearMonth(b.startMonth), 'punya bulan mulai tidak valid');
    check('bills', i, optional(b.endMonth, (v) => typeof v === 'string' && isValidYearMonth(v)), 'punya bulan berakhir tidak valid');
  });

  rows('transactions').forEach((r, i) => {
    const t = r as Rec;
    check('transactions', i, oneOf(['income', 'expense', 'transfer', 'adjustment'])(t.type), 'punya jenis tidak dikenal');
    check('transactions', i, typeof t.date === 'string' && isValidLocalDate(t.date), 'punya tanggal tidak valid');
    check('transactions', i, isInt(t.amount, 1, MAX_AMOUNT), 'punya nominal tidak valid');
    check('transactions', i, accountIds.has(t.accountId as string), 'merujuk akun yang tidak ada');
    if (t.type === 'transfer') check('transactions', i, accountIds.has(t.toAccountId as string), 'merujuk akun tujuan yang tidak ada');
    if (t.type === 'income' || t.type === 'expense') check('transactions', i, categoryIds.has(t.categoryId as string), 'merujuk kategori yang tidak ada');
    if (t.type === 'adjustment') check('transactions', i, oneOf(['increase', 'decrease'])(t.adjustDirection), 'tidak punya arah penyesuaian');
    check('transactions', i, optional(t.billId, (v) => billIds.has(v as string)), 'merujuk tagihan yang tidak ada');
    check('transactions', i, optional(t.billPeriod, (v) => typeof v === 'string' && isValidYearMonth(v)), 'punya periode tagihan tidak valid');
    check('transactions', i, optional(t.note, (v) => typeof v === 'string'), 'punya catatan tidak valid');
    check('transactions', i, optional(t.isRefund, isBool) && optional(t.groupId, isStr), 'punya data tidak valid');
    check('transactions', i, typeof t.createdAt === 'string' && typeof t.updatedAt === 'string', 'tidak punya waktu pencatatan');
  });

  rows('budgetLimits').forEach((r, i) => {
    const l = r as Rec;
    check('budgetLimits', i, categoryIds.has(l.categoryId as string), 'merujuk kategori yang tidak ada');
    check('budgetLimits', i, typeof l.effectiveFrom === 'string' && isValidYearMonth(l.effectiveFrom), 'punya bulan tidak valid');
    check('budgetLimits', i, isInt(l.amount, 0, MAX_AMOUNT), 'punya batas tidak valid');
  });

  const skipKeys = new Set<string>();
  rows('billSkips').forEach((r, i) => {
    const s = r as Rec;
    check('billSkips', i, isObj(s) && billIds.has(s.billId as string), 'merujuk tagihan yang tidak ada');
    check('billSkips', i, typeof s.period === 'string' && isValidYearMonth(s.period), 'punya periode tidak valid');
    const key = `${s.billId}|${s.period}`;
    check('billSkips', i, !skipKeys.has(key), 'ganda');
    skipKeys.add(key);
  });

  const goalAccounts = new Set<string>();
  rows('goals').forEach((r, i) => {
    const g = r as Rec;
    check('goals', i, isStr(g.name) && typeof g.icon === 'string' && oneOf(['custom', 'emergency'])(g.kind), 'punya nama/jenis tidak valid');
    check('goals', i, isInt(g.targetAmount, 1, MAX_AMOUNT) && isInt(g.startAmount, 0, Number.MAX_SAFE_INTEGER), 'punya nominal tidak valid');
    check('goals', i, typeof g.targetMonth === 'string' && isValidYearMonth(g.targetMonth), 'punya bulan target tidak valid');
    check('goals', i, typeof g.startDate === 'string' && isValidLocalDate(g.startDate), 'punya tanggal mulai tidak valid');
    check('goals', i, accountIds.has(g.accountId as string), 'merujuk akun yang tidak ada');
    check('goals', i, isBool(g.archived) && typeof g.sortOrder === 'number', 'punya data tidak lengkap');
    if (!g.archived) {
      check('goals', i, !goalAccounts.has(g.accountId as string), 'memakai akun yang sama dengan target aktif lain');
      goalAccounts.add(g.accountId as string);
    }
  });

  const settingKeys = new Set<string>();
  rows('settings').forEach((r, i) => {
    check('settings', i, isObj(r) && isStr(r.key) && !settingKeys.has(r.key as string), 'tidak valid');
    settingKeys.add((r as Rec).key as string);
  });
}

/** Parse + validasi + migrasi. Tidak pernah menulis ke database. */
export function parseBackup(text: string): ParseResult {
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new BackupError('File ini bukan file backup yang valid (format JSON rusak).');
    }
    if (!isObj(raw) || raw.app !== BACKUP_APP_ID) {
      throw new BackupError('File ini bukan backup dari aplikasi Dompet Waras.');
    }
    if (!isInt(raw.formatVersion, 1, BACKUP_FORMAT_VERSION) || !isInt(raw.schemaVersion, 1, Number.MAX_SAFE_INTEGER)) {
      throw new BackupError('Versi file backup tidak dikenal.');
    }
    if ((raw.schemaVersion as number) > SCHEMA_VERSION) {
      throw new BackupError('File backup dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasi lalu coba lagi.');
    }
    if (!isObj(raw.data)) throw new BackupError('File backup tidak berisi data.');
    if (typeof raw.exportedAt !== 'string' || Number.isNaN(Date.parse(raw.exportedAt))) {
      throw new BackupError('File backup tidak punya tanggal pembuatan yang valid.');
    }

    const backup = migrateBackup(raw as unknown as BackupFile);
    validateData(backup.data as unknown as Rec);

    const counts = countsOf(backup.data);
    const dates = backup.data.transactions.map((t) => t.date).sort();
    return {
      ok: true,
      backup: { ...backup, counts },
      summary: {
        exportedAt: backup.exportedAt,
        counts,
        firstDate: dates[0] ?? null,
        lastDate: dates.at(-1) ?? null,
        accountNames: backup.data.accounts.filter((a) => !a.archived).map((a) => a.name),
      },
    };
  } catch (error) {
    if (error instanceof BackupError) return { ok: false, error: error.message };
    return { ok: false, error: 'File backup tidak bisa dibaca.' };
  }
}
