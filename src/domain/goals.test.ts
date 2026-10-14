import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseBackup } from '../backup/validate';
import { createBackup, serializeBackup, type BackupFile } from '../backup/format';
import { restoreBackup } from '../backup/restore';
import { saveAccount, setAccountArchived, deleteAccount } from '../db/accounts';
import { saveBill, setBillSkipped } from '../db/bills';
import { GoalValidationError, createGoal, deleteGoal, setGoalArchived, updateGoal } from '../db/goals';
import { completeOnboarding } from '../db/onboarding';
import { KeuanganDB } from '../db/schema';
import { saveTransaction } from '../db/transactions';
import { availableMoney } from './bills';
import { computeBalances, computeTotals } from './balance';
import { makeAccount, makeTx } from '../test/factories';
import {
  averageMonthlyGrowth,
  completionMonth,
  emergencyFundSuggestion,
  goalProgress,
  goalSchedule,
  monthsLeft,
  reachedMilestone,
  requiredPerMonth,
  validateGoal,
} from './goals';
import type { Goal } from './types';

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'rumah',
  name: 'DP Rumah',
  icon: '🏠',
  kind: 'custom',
  targetAmount: 120_000_000,
  targetMonth: '2027-09',
  accountId: 'tab',
  startDate: '2026-10-01',
  startAmount: 0,
  archived: false,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('Perhitungan target', () => {
  it('progres dibatasi 0–100% dan saldo negatif dianggap 0', () => {
    expect(goalProgress(goal(), 30_000_000)).toEqual({ saved: 30_000_000, remaining: 90_000_000, ratio: 0.25, done: false });
    expect(goalProgress(goal(), 130_000_000)).toMatchObject({ remaining: 0, ratio: 1, done: true });
    expect(goalProgress(goal(), -5)).toMatchObject({ saved: 0, ratio: 0 });
  });

  it('sisa bulan menghitung bulan berjalan; perlu per bulan dibulatkan ke atas', () => {
    expect(monthsLeft('2027-09', '2026-10-14')).toBe(12);
    expect(monthsLeft('2026-10', '2026-10-31')).toBe(1);
    expect(monthsLeft('2026-09', '2026-10-01')).toBe(0);
    expect(requiredPerMonth(90_000_000, '2027-09', '2026-10-14')).toBe(7_500_000);
    expect(requiredPerMonth(100, '2026-12', '2026-10-14')).toBe(34);
    expect(requiredPerMonth(5_000, '2026-09', '2026-10-14')).toBe(5_000); // tenggat lewat: sisa sekaligus
    expect(requiredPerMonth(0, '2027-09', '2026-10-14')).toBe(0);
  });

  it('status jadwal: sesuai, tertinggal, lebih cepat, selesai, lewat tenggat', () => {
    const g = goal({ targetAmount: 12_000_000, startDate: '2026-01-01', targetMonth: '2026-12' });
    // Pertengahan tahun: seharusnya ±separuh terkumpul.
    const mid = goalSchedule(g, 6_000_000, '2026-07-02');
    expect(mid.status).toBe('on_track');
    expect(Math.abs(mid.difference)).toBeLessThan(120_000);
    expect(goalSchedule(g, 4_000_000, '2026-07-02')).toMatchObject({ status: 'behind' });
    expect(goalSchedule(g, 4_000_000, '2026-07-02').difference).toBeLessThan(-1_900_000);
    expect(goalSchedule(g, 9_000_000, '2026-07-02').status).toBe('ahead');
    expect(goalSchedule(g, 12_000_000, '2026-07-02').status).toBe('done');
    expect(goalSchedule(g, 11_000_000, '2027-01-03').status).toBe('overdue');
    // Baru dibuat: selalu sesuai jadwal.
    expect(goalSchedule(goal({ startAmount: 5_000_000, startDate: '2026-10-14' }), 5_000_000, '2026-10-14').status).toBe('on_track');
  });

  it('rata-rata 3 bulan penuh terakhir dari setoran, penarikan, dan penyesuaian nilai', () => {
    const tab = makeAccount({ id: 'tab', openingBalance: 0, openingDate: '2026-06-01', includeInAvailable: false });
    const txs = [
      makeTx({ type: 'transfer', amount: 3_000_000, accountId: 'bca', toAccountId: 'tab', date: '2026-07-26' }),
      makeTx({ type: 'transfer', amount: 4_000_000, accountId: 'bca', toAccountId: 'tab', date: '2026-08-26' }),
      makeTx({ type: 'transfer', amount: 500_000, accountId: 'tab', toAccountId: 'bca', date: '2026-08-30' }), // ditarik
      makeTx({ type: 'transfer', amount: 2_000_000, accountId: 'bca', toAccountId: 'tab', date: '2026-09-26' }),
      makeTx({ type: 'adjustment', amount: 100_000, accountId: 'tab', adjustDirection: 'increase', date: '2026-09-30' }),
      makeTx({ type: 'transfer', amount: 9_000_000, accountId: 'bca', toAccountId: 'tab', date: '2026-10-05' }), // bulan berjalan: diabaikan
      makeTx({ type: 'transfer', amount: 1_000_000, accountId: 'bca', toAccountId: 'gopay', date: '2026-09-01' }), // akun lain
    ];
    // Jul 3jt, Agu 3,5jt, Sep 2,1jt → 8,6jt / 3
    expect(averageMonthlyGrowth(tab, txs, '2026-10-14')).toBe(2_866_667);
    // Akun baru dibuka bulan ini: belum ada bulan penuh.
    expect(averageMonthlyGrowth({ ...tab, openingDate: '2026-10-01' }, txs, '2026-10-14')).toBeNull();
    // Dibuka Sep: hanya Sep yang dihitung.
    expect(averageMonthlyGrowth({ ...tab, openingDate: '2026-09-01' }, txs, '2026-10-14')).toBe(2_100_000);
  });

  it('proyeksi & simulasi bulan tercapai', () => {
    expect(completionMonth(90_000_000, 7_500_000, '2026-10-14')).toBe('2027-09');
    expect(completionMonth(90_000_000, 7_000_000, '2026-10-14')).toBe('2027-10');
    expect(completionMonth(0, 0, '2026-10-14')).toBe('2026-10');
    expect(completionMonth(1, 0, '2026-10-14')).toBeNull();
    expect(completionMonth(1, -5, '2026-10-14')).toBeNull();
  });

  it('tonggak 25/50/75/100%', () => {
    expect(reachedMilestone(0.24)).toBeNull();
    expect(reachedMilestone(0.25)).toBe(25);
    expect(reachedMilestone(0.749)).toBe(50);
    expect(reachedMilestone(1)).toBe(100);
  });

  it('saran Dana Darurat = rata-rata pengeluaran 3 bulan penuh × 6, dibulatkan ke Rp100rb', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 4_000_000, accountId: 'bca', categoryId: 'makan', date: '2026-07-10' }),
      makeTx({ type: 'expense', amount: 5_000_000, accountId: 'bca', categoryId: 'makan', date: '2026-08-10' }),
      makeTx({ type: 'expense', amount: 4_550_000, accountId: 'bca', categoryId: 'makan', date: '2026-09-10' }),
      makeTx({ type: 'expense', amount: 99_000_000, accountId: 'bca', categoryId: 'makan', date: '2026-10-10' }), // bulan berjalan
    ];
    expect(emergencyFundSuggestion(txs, '2026-10-14')).toEqual({ monthlyExpense: 4_516_667, amount: 27_100_000, months: 3 });
    // Pengguna baru: belum ada bulan penuh → perkiraan dari bulan berjalan.
    expect(emergencyFundSuggestion([txs[3]], '2026-10-14')?.months).toBe(1);
    expect(emergencyFundSuggestion([], '2026-10-14')).toBeNull();
  });

  it('validasi: akun aset aktif, 1 akun hanya untuk 1 target aktif, bulan tidak lampau', () => {
    const accountsById = new Map([
      ['tab', makeAccount({ id: 'tab' })],
      ['kartu', makeAccount({ id: 'kartu', group: 'liability' })],
    ]);
    const ctx = { accountsById, goals: [goal({ id: 'lain', name: 'Mobil' })], today: '2026-10-14', isNew: true };
    const draft = { id: 'baru', name: 'Liburan', icon: '✈️', kind: 'custom' as const, targetAmount: 1, targetMonth: '2026-10', accountId: 'tab' };
    expect(validateGoal(draft, ctx).accountId).toMatch(/Mobil/);
    expect(validateGoal({ ...draft, accountId: 'kartu' }, ctx).accountId).toMatch(/aset/);
    expect(validateGoal({ ...draft, targetMonth: '2026-09' }, { ...ctx, goals: [] }).targetMonth).toMatch(/sebelum/);
    expect(validateGoal({ ...draft, name: '', targetAmount: 0 }, { ...ctx, goals: [] })).toMatchObject({ name: expect.any(String), targetAmount: expect.any(String) });
    expect(validateGoal(draft, { ...ctx, goals: [goal({ id: 'lain', archived: true })] })).toEqual({});
  });
});

describe('Repositori target', () => {
  let db: KeuanganDB;
  let n = 0;
  const TODAY = '2026-10-14';
  const base = { group: 'asset' as const, kind: 'bank' as const, openingDate: '2026-10-01', includeInAvailable: true };

  beforeEach(async () => {
    db = new KeuanganDB(`goals-${++n}`);
    await completeOnboarding(db, { ...base, id: 'bca', name: 'BCA', openingBalance: 10_000_000 }, { today: TODAY });
  });
  afterEach(() => db.delete());

  const draft = { id: 'rumah', name: 'DP Rumah', icon: '🏠', kind: 'custom' as const, targetAmount: 120_000_000, targetMonth: '2027-09', accountId: 'tab' };

  it('membuat akun baru + target + tagihan setoran secara atomik; akun keluar dari Uang tersedia', async () => {
    const created = await createGoal(db, {
      goal: draft,
      newAccount: { ...base, id: 'tab', name: 'Tabungan Rumah', openingBalance: 30_000_000 },
      deposit: { amount: 7_500_000, dueDay: 26, fromAccountId: 'bca' },
      today: TODAY,
    });
    expect(created).toMatchObject({ startAmount: 30_000_000, startDate: TODAY, archived: false });
    expect((await db.accounts.get('tab'))?.includeInAvailable).toBe(false);

    const [bill] = await db.bills.toArray();
    expect(bill).toMatchObject({ name: 'Nabung DP Rumah', kind: 'transfer', amount: 7_500_000, dueDay: 26, accountId: 'bca', toAccountId: 'tab', startMonth: '2026-10', endMonth: '2027-09' });

    // Uang tersedia: kas BCA 10jt − setoran 7,5jt (Tabungan Rumah tidak dihitung).
    const accounts = await db.accounts.toArray();
    const balances = computeBalances(accounts, []);
    const totals = computeTotals(accounts, balances);
    expect(totals.totalCash).toBe(10_000_000);
    expect(availableMoney(accounts, totals.totalCash, [bill], [], [], TODAY).available).toBe(2_500_000);
  });

  it('akun yang sudah ada: saldo saat ini menjadi titik awal jadwal', async () => {
    await saveAccount(db, { ...base, id: 'tab', name: 'Jago Kantong', openingBalance: 1_000_000 }, { today: TODAY });
    await saveTransaction(db, { id: 't', type: 'transfer', date: TODAY, amount: 2_000_000, accountId: 'bca', toAccountId: 'tab' }, { today: TODAY });
    const created = await createGoal(db, { goal: draft, today: TODAY });
    expect(created.startAmount).toBe(3_000_000);
    expect(await db.bills.count()).toBe(0);
  });

  it('gagal validasi → tidak ada yang tersimpan, termasuk akun baru', async () => {
    await expect(
      createGoal(db, { goal: { ...draft, targetAmount: 0 }, newAccount: { ...base, id: 'tab', name: 'Tab', openingBalance: 0 }, today: TODAY }),
    ).rejects.toBeInstanceOf(GoalValidationError);
    expect(await db.accounts.get('tab')).toBeUndefined();
    expect(await db.goals.count()).toBe(0);
  });

  it('ubah, arsipkan, hapus; akun target dilindungi', async () => {
    await createGoal(db, { goal: draft, newAccount: { ...base, id: 'tab', name: 'Tab', openingBalance: 0 }, today: TODAY });
    const updated = await updateGoal(db, { ...draft, name: 'Rumah Impian', targetAmount: 150_000_000, accountId: 'bca' }, TODAY);
    expect(updated).toMatchObject({ name: 'Rumah Impian', targetAmount: 150_000_000, accountId: 'tab' });

    await expect(setAccountArchived(db, 'tab', true)).rejects.toThrow(/Rumah Impian/);
    await expect(deleteAccount(db, 'tab')).rejects.toThrow(/target/);

    await setGoalArchived(db, 'rumah', true);
    await setAccountArchived(db, 'tab', true);
    await deleteGoal(db, 'rumah');
    expect(await db.goals.count()).toBe(0);
    expect(await db.accounts.get('tab')).toBeDefined();
  });

  it('hapus target ikut menghapus setoran rutinnya; yang sudah pernah dibayar hanya dinonaktifkan', async () => {
    const deposit = { amount: 1_000_000, dueDay: 26, fromAccountId: 'bca' };
    await createGoal(db, { goal: draft, newAccount: { ...base, id: 'tab', name: 'Tab', openingBalance: 0 }, deposit, today: TODAY });
    const [bill] = await db.bills.toArray();
    await setBillSkipped(db, { billId: bill.id, period: '2026-11', skipped: true });
    await saveBill(db, { id: 'lain', name: 'Listrik', kind: 'expense', amount: 300_000, isVariable: false, dueDay: 5, accountId: 'bca', categoryId: 'cat-tagihan', startMonth: '2026-10' });

    await deleteGoal(db, 'rumah');
    expect((await db.bills.toArray()).map((b) => b.id)).toEqual(['lain']);
    expect(await db.billSkips.count()).toBe(0);
    expect(await db.accounts.get('tab')).toBeDefined();

    await createGoal(db, { goal: { ...draft, id: 'mobil' }, deposit, today: TODAY });
    const paid = (await db.bills.toArray()).find((b) => b.toAccountId === 'tab')!;
    await saveTransaction(db, { id: 'p', type: 'transfer', date: TODAY, amount: 1_000_000, accountId: 'bca', toAccountId: 'tab', billId: paid.id, billPeriod: '2026-10' }, { today: TODAY });
    await deleteGoal(db, 'mobil');
    expect(await db.bills.get(paid.id)).toMatchObject({ active: false });
    expect(await db.transactions.get('p')).toBeDefined();
  });

  it('arsipkan target menonaktifkan setoran rutinnya', async () => {
    await createGoal(db, { goal: draft, newAccount: { ...base, id: 'tab', name: 'Tab', openingBalance: 0 }, deposit: { amount: 1_000_000, dueDay: 26, fromAccountId: 'bca' }, today: TODAY });
    await setGoalArchived(db, 'rumah', true);
    expect((await db.bills.toArray()).map((b) => b.active)).toEqual([false]);
  });

  it('backup → restore membawa target; file backup v1 tetap bisa dipulihkan', async () => {
    await createGoal(db, { goal: draft, newAccount: { ...base, id: 'tab', name: 'Tab', openingBalance: 0 }, today: TODAY });
    const parsed = parseBackup(serializeBackup(await createBackup(db)));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.summary.counts.goals).toBe(1);
    await db.goals.clear();
    await restoreBackup(db, parsed.backup);
    expect((await db.goals.toArray()).map((g) => g.name)).toEqual(['DP Rumah']);

    const v1 = JSON.parse(serializeBackup(parsed.backup)) as BackupFile;
    v1.schemaVersion = 1;
    delete (v1.data as Partial<BackupFile['data']>).goals;
    const migrated = parseBackup(JSON.stringify(v1));
    expect(migrated.ok && migrated.backup.data.goals).toEqual([]);

    const broken = JSON.parse(serializeBackup(parsed.backup)) as BackupFile;
    broken.data.goals[0].accountId = 'hilang';
    const result = parseBackup(JSON.stringify(broken));
    expect(!result.ok && result.error).toMatch(/target ke-1 merujuk akun/);
  });
});
