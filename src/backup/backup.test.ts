import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeBalances, computeTotals } from '../domain/balance';
import { shouldRemindBackup } from '../domain/backupReminder';
import { monthSummary } from '../domain/report';
import { saveAccount } from '../db/accounts';
import { setBudgetLimit } from '../db/budgets';
import { saveBill, setBillSkipped } from '../db/bills';
import { completeOnboarding } from '../db/onboarding';
import { KeuanganDB } from '../db/schema';
import { getAllSettings } from '../db/settings';
import { saveTransaction } from '../db/transactions';
import { transactionsToCsv, sanitizeCell } from './csv';
import { BACKUP_TABLES, backupFileName, createBackup, serializeBackup, type BackupFile } from './format';
import { MIGRATIONS, migrateBackup } from './migrate';
import { restoreBackup, wipeAllData } from './restore';
import { parseBackup } from './validate';
import fixtureText from '../test/fixtures/backup-v1.json?raw';

const TODAY = '2026-10-13';
let db: KeuanganDB;
let n = 0;

async function seed(target: KeuanganDB) {
  const base = { group: 'asset' as const, kind: 'bank' as const, openingDate: '2026-10-01', includeInAvailable: true };
  await completeOnboarding(target, { ...base, id: 'bca', name: 'BCA', openingBalance: 3_000_000 }, { today: TODAY });
  await saveAccount(target, { ...base, id: 'gopay', name: 'GoPay', kind: 'ewallet', openingBalance: 0 }, { today: TODAY });
  await saveAccount(target, { ...base, id: 'kartu', name: 'Kartu', group: 'liability', kind: 'credit_card', openingBalance: 0 }, { today: TODAY });
  await saveTransaction(target, { id: 'g', type: 'income', date: '2026-10-01', amount: 9_000_000, accountId: 'bca', categoryId: 'cat-gaji' }, { today: TODAY });
  await saveTransaction(target, { id: 'm', type: 'expense', date: '2026-10-05', amount: 250_000, accountId: 'kartu', categoryId: 'cat-makan', note: 'Makan "enak"; banyak' }, { today: TODAY });
  await saveTransaction(target, { id: 'tr', type: 'transfer', date: '2026-10-06', amount: 500_000, accountId: 'bca', toAccountId: 'gopay' }, { today: TODAY, fee: { amount: 1_000, categoryId: 'cat-biaya' } });
  await setBudgetLimit(target, { categoryId: 'cat-makan', month: '2026-10', amount: 1_000_000 });
  await saveBill(target, { id: 'b', name: 'Kartu', kind: 'transfer', amount: 300_000, isVariable: true, dueDay: 25, accountId: 'bca', toAccountId: 'kartu', startMonth: '2026-10' });
  await setBillSkipped(target, { billId: 'b', period: '2026-11', skipped: true });
}

async function snapshot(target: KeuanganDB) {
  const out: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    if (t === 'settings') continue;
    out[t] = (await target[t].toArray()).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return out;
}

beforeEach(async () => {
  db = new KeuanganDB(`backup-${++n}`);
  await seed(db);
});
afterEach(() => db.delete());

describe('Backup & restore', () => {
  it('QA-16 backup → hapus semua → restore menghasilkan data identik', async () => {
    const before = await snapshot(db);
    const balancesBefore = computeBalances(await db.accounts.toArray(), await db.transactions.toArray());
    const text = serializeBackup(await createBackup(db, new Date('2026-10-13T14:30:00Z')));

    await wipeAllData(db);
    expect(await db.accounts.count()).toBe(0);

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.summary).toMatchObject({ firstDate: '2026-10-01', lastDate: '2026-10-06', accountNames: ['BCA', 'GoPay', 'Kartu'] });
    expect(parsed.summary.counts).toMatchObject({ accounts: 3, transactions: 4, bills: 1, billSkips: 1, budgetLimits: 1 });

    await restoreBackup(db, parsed.backup);
    expect(await snapshot(db)).toEqual(before);
    expect(computeBalances(await db.accounts.toArray(), await db.transactions.toArray())).toEqual(balancesBefore);

    const settings = await getAllSettings(db);
    expect(settings).toMatchObject({ onboardingDone: true, feeCategoryId: 'cat-biaya', lastBackupAt: '2026-10-13T14:30:00.000Z' });
  });

  it('restore mengganti data lama sepenuhnya (bukan menggabungkan)', async () => {
    const other = new KeuanganDB(`backup-other-${n}`);
    await completeOnboarding(other, { id: 'mandiri', name: 'Mandiri', group: 'asset', kind: 'bank', openingBalance: 1, openingDate: TODAY, includeInAvailable: true }, { today: TODAY });
    const parsed = parseBackup(serializeBackup(await createBackup(other)));
    await other.delete();
    if (!parsed.ok) throw new Error(parsed.error);

    await restoreBackup(db, parsed.backup);
    expect((await db.accounts.toArray()).map((a) => a.name)).toEqual(['Mandiri']);
    expect(await db.transactions.count()).toBe(0);
  });

  it('QA-17 file rusak/asing/rujukan hilang ditolak dengan pesan jelas tanpa menyentuh data', async () => {
    const good = JSON.parse(serializeBackup(await createBackup(db))) as BackupFile;
    const variant = (mutate: (b: BackupFile) => void) => {
      const copy = structuredClone(good);
      mutate(copy);
      return JSON.stringify(copy);
    };
    const cases: Array<[string, RegExp]> = [
      ['{tidak json', /JSON rusak/],
      [JSON.stringify({ app: 'aplikasi-lain' }), /bukan backup/],
      [variant((b) => (b.schemaVersion = 99)), /versi aplikasi yang lebih baru/],
      [variant((b) => (b.formatVersion = 7)), /Versi file backup/],
      [variant((b) => delete (b.data as Partial<BackupFile['data']>).bills), /tagihan tidak ada/],
      [variant((b) => (b.data.transactions[0].accountId = 'hilang')), /transaksi ke-\d+ merujuk akun/],
      [variant((b) => (b.data.transactions[0].amount = 1.5)), /nominal tidak valid/],
      [variant((b) => (b.data.transactions[0].date = '2026-02-30')), /tanggal tidak valid/],
      [variant((b) => b.data.accounts.push({ ...b.data.accounts[0] })), /ID ganda/],
      [variant((b) => (b.data.bills[0].categoryId = 'hilang')), /tagihan ke-1 merujuk kategori/],
      [variant((b) => (b.data.billSkips[0].billId = 'hilang')), /tagihan dilewati ke-1/],
      [variant((b) => (b.exportedAt = 'kemarin')), /tanggal pembuatan/],
    ];
    const before = await snapshot(db);
    for (const [text, message] of cases) {
      const result = parseBackup(text);
      expect(result.ok, text.slice(0, 60)).toBe(false);
      if (!result.ok) expect(result.error).toMatch(message);
    }
    expect(await snapshot(db)).toEqual(before);
  });

  it('QA-18 memulihkan fixture backup skema v1 menghasilkan angka yang diharapkan', async () => {
    const parsed = parseBackup(fixtureText);
    if (!parsed.ok) throw new Error(parsed.error);
    await restoreBackup(db, parsed.backup);

    const accounts = await db.accounts.toArray();
    const transactions = await db.transactions.toArray();
    const balances = computeBalances(accounts, transactions);
    // BCA: 2jt + 8jt − 1jt − 2.500 − 500rb; GoPay: 1jt − 7.500; Kartu: 500rb − 500rb.
    expect(Object.fromEntries(balances)).toEqual({ bca: 8_497_500, gopay: 992_500, kartu: 0 });
    expect(computeTotals(accounts, balances)).toEqual({ totalCash: 9_490_000, totalDebt: 0, netWorth: 9_490_000 });
    expect(monthSummary(transactions, '2026-10')).toEqual({ income: 8_000_000, expense: 502_500, net: 7_497_500 });
  });

  it('migrasi dijalankan berurutan dari versi lama', () => {
    const v1 = JSON.parse(fixtureText) as BackupFile;
    expect(migrateBackup(v1)).toBe(v1); // sudah versi terbaru
    MIGRATIONS[0] = (b) => ({ ...b, schemaVersion: 1, exportedAt: 'dimigrasi' });
    try {
      expect(migrateBackup({ ...v1, schemaVersion: 0 }).exportedAt).toBe('dimigrasi');
    } finally {
      delete MIGRATIONS[0];
    }
    expect(() => migrateBackup({ ...v1, schemaVersion: 0 })).toThrow(/migrasi/);
  });

  it('QA-19 error di tengah restore: data lama tetap utuh', async () => {
    const before = await snapshot(db);
    const parsed = parseBackup(fixtureText);
    if (!parsed.ok) throw new Error(parsed.error);
    await expect(
      restoreBackup(db, parsed.backup, {
        afterClear: () => {
          throw new Error('listrik padam');
        },
      }),
    ).rejects.toThrow('listrik padam');
    expect(await snapshot(db)).toEqual(before);
  });

  it('nama file memakai waktu lokal', () => {
    expect(backupFileName(new Date(2026, 9, 13, 21, 5))).toBe('keuangan-backup-2026-10-13-2105.json');
  });
});

describe('Ekspor CSV', () => {
  it('QA-23 sel berbahaya diberi prefiks; titik koma & kutip di-escape; BOM + header', async () => {
    const parsed = parseBackup(fixtureText);
    if (!parsed.ok) throw new Error(parsed.error);
    const { accounts, categories, transactions } = parsed.backup.data;
    const csv = transactionsToCsv(transactions, new Map(accounts.map((a) => [a.id, a])), new Map(categories.map((c) => [c.id, c])));
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('Tanggal;Jenis;Akun;Akun Tujuan;Kategori;Refund;Nominal;Catatan');
    expect(lines).toContain("2026-10-02;Pengeluaran;Kartu BCA;;Makan & Minum;;500000;'=SUM(A1:A9)");
    expect(lines).toContain('2026-10-03;Transfer;BCA;GoPay;;;1000000;');
    expect(lines).toContain('2026-10-12;Penyesuaian −;GoPay;;;;7500;');
    expect(lines).toHaveLength(7);

    const ranged = transactionsToCsv(transactions, new Map(), new Map(), { from: '2026-10-03', to: '2026-10-10' });
    expect(ranged.trimEnd().split('\r\n')).toHaveLength(4);
  });

  it('sanitizeCell', () => {
    expect(sanitizeCell('+62 812')).toBe("'+62 812");
    expect(sanitizeCell('-5000')).toBe("'-5000");
    expect(sanitizeCell('@user')).toBe("'@user");
    expect(sanitizeCell('Makan "enak"; banyak')).toBe('"Makan ""enak""; banyak"');
    expect(sanitizeCell('biasa')).toBe('biasa');
  });
});

describe('Pengingat backup', () => {
  const base = {
    hasData: true,
    lastBackupAt: '2026-10-01T10:00:00.000Z',
    lastDataChangeAt: '2026-10-12T10:00:00.000Z',
    reminderDays: 7,
    dismissedOn: null,
    today: '2026-10-13',
  };

  it('tampil jika > 7 hari dan ada perubahan sejak backup terakhir', () => {
    expect(shouldRemindBackup(base)).toBe(true);
  });

  it('tidak tampil jika belum lewat ambang, tidak ada perubahan, tanpa data, atau ditutup hari ini', () => {
    expect(shouldRemindBackup({ ...base, lastBackupAt: '2026-10-08T10:00:00.000Z' })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastDataChangeAt: '2026-09-30T10:00:00.000Z' })).toBe(false);
    expect(shouldRemindBackup({ ...base, hasData: false })).toBe(false);
    expect(shouldRemindBackup({ ...base, dismissedOn: '2026-10-13' })).toBe(false);
    expect(shouldRemindBackup({ ...base, dismissedOn: '2026-10-12' })).toBe(true);
  });

  it('belum pernah backup → selalu tampil selama ada data', () => {
    expect(shouldRemindBackup({ ...base, lastBackupAt: null })).toBe(true);
  });
});
