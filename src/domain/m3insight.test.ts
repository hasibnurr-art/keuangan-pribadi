import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KeuanganDB } from '../db/schema';
import { setBudgetLimit } from '../db/budgets';
import { seedDefaultCategories } from '../db/onboarding';
import { formatCompact, formatPercent } from '../lib/money';
import { makeTx } from '../test/factories';
import { niceTicks } from '../ui/charts';
import { budgetStatus, riskiestBudgets, sumBudgets, type BudgetStatus } from './budget';
import { categoryBreakdown, compareValues } from './report';

describe('Perbandingan periode', () => {
  it('menghitung selisih dan rasio; rasio null jika bulan lalu 0', () => {
    expect(compareValues(1_200_000, 1_000_000)).toEqual({ delta: 200_000, ratio: 0.2 });
    expect(compareValues(800_000, 1_000_000)).toEqual({ delta: -200_000, ratio: -0.2 });
    expect(compareValues(500, 0)).toEqual({ delta: 500, ratio: null });
    // Selisih negatif → positif: rasio terhadap nilai absolut.
    expect(compareValues(100, -200).ratio).toBe(1.5);
  });
});

describe('Rincian per kategori', () => {
  it('urut dari terbesar, persen dari total positif, refund > belanja di akhir', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 300_000, accountId: 'bca', categoryId: 'makan', date: '2026-10-01' }),
      makeTx({ type: 'expense', amount: 100_000, accountId: 'bca', categoryId: 'transport', date: '2026-10-02' }),
      makeTx({ type: 'income', amount: 50_000, accountId: 'bca', categoryId: 'hiburan', isRefund: true, date: '2026-10-03' }),
      makeTx({ type: 'expense', amount: 20_000, accountId: 'bca', categoryId: 'pulsa', date: '2026-10-04' }),
      makeTx({ type: 'income', amount: 20_000, accountId: 'bca', categoryId: 'pulsa', isRefund: true, date: '2026-10-05' }),
      makeTx({ type: 'expense', amount: 999, accountId: 'bca', categoryId: 'makan', date: '2026-09-30' }),
    ];
    expect(categoryBreakdown(txs, '2026-10')).toEqual([
      { categoryId: 'makan', amount: 300_000, share: 0.75 },
      { categoryId: 'transport', amount: 100_000, share: 0.25 },
      { categoryId: 'hiburan', amount: -50_000, share: 0 },
    ]);
    expect(categoryBreakdown([], '2026-10')).toEqual([]);
  });
});

describe('Anggaran di dashboard', () => {
  it('3 kategori paling berisiko, rasio tertinggi dulu', () => {
    const statuses = new Map<string, BudgetStatus>([
      ['a', budgetStatus(100, 50)],
      ['b', budgetStatus(100, 120)],
      ['c', budgetStatus(100, 85)],
      ['d', budgetStatus(100, 10)],
    ]);
    expect(riskiestBudgets(statuses).map(([id]) => id)).toEqual(['b', 'c', 'a']);
    expect(sumBudgets(statuses)).toEqual({ limit: 400, spent: 265 });
  });
});

describe('Format grafik', () => {
  it('sumbu "bersih" yang menutupi nilai maksimum', () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(9_700_000)).toEqual([0, 2_500_000, 5_000_000, 7_500_000, 10_000_000]);
    expect(niceTicks(300_000)).toEqual([0, 100_000, 200_000, 300_000]);
    expect(niceTicks(1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('angka ringkas dan persen', () => {
    // Intl memakai spasi tak terputus (U+00A0) agar angka dan satuan tidak terpisah baris.
    expect(formatCompact(5_000_000)).toBe('5 jt');
    expect(formatCompact(250_000)).toBe('250 rb');
    expect(formatPercent(0.126)).toBe('13%');
  });
});

describe('setBudgetLimit', () => {
  let db: KeuanganDB;
  let n = 0;
  beforeEach(async () => {
    db = new KeuanganDB(`m3-${++n}`);
    await seedDefaultCategories(db);
  });
  afterEach(() => db.delete());

  it('mengubah batas di bulan yang sama memperbarui record yang sama', async () => {
    const a = await setBudgetLimit(db, { categoryId: 'cat-makan', month: '2026-10', amount: 1_000_000 });
    const b = await setBudgetLimit(db, { categoryId: 'cat-makan', month: '2026-10', amount: 1_500_000 });
    expect(b.id).toBe(a.id);
    expect(await db.budgetLimits.count()).toBe(1);
  });

  it('bulan berbeda membuat record baru (riwayat batas tetap)', async () => {
    await setBudgetLimit(db, { categoryId: 'cat-makan', month: '2026-09', amount: 1_000_000 });
    await setBudgetLimit(db, { categoryId: 'cat-makan', month: '2026-10', amount: 0 });
    const limits = await db.budgetLimits.orderBy('effectiveFrom').toArray();
    expect(limits.map((l) => [l.effectiveFrom, l.amount])).toEqual([
      ['2026-09', 1_000_000],
      ['2026-10', 0],
    ]);
  });

  it('menolak kategori pemasukan dan nominal tidak valid', async () => {
    await expect(setBudgetLimit(db, { categoryId: 'cat-gaji', month: '2026-10', amount: 1 })).rejects.toThrow(/pengeluaran/);
    await expect(setBudgetLimit(db, { categoryId: 'cat-makan', month: '2026-10', amount: -1 })).rejects.toThrow();
    await expect(setBudgetLimit(db, { categoryId: 'cat-makan', month: '2026-10', amount: 1.5 })).rejects.toThrow();
  });
});
