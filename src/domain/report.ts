// Laporan bulanan (PRD §8.4). Transfer dan penyesuaian tidak pernah masuk
// pemasukan/pengeluaran. Refund mengurangi pengeluaran kategori asalnya.

import { addMonths, toYearMonth } from '../lib/date';
import type { ID, Rupiah, Transaction, YearMonth } from './types';

export interface MonthSummary {
  income: Rupiah;
  expense: Rupiah;
  net: Rupiah;
}

const inMonth = (tx: Transaction, ym: YearMonth) => toYearMonth(tx.date) === ym;

export function isRefund(tx: Transaction): boolean {
  return tx.type === 'income' && tx.isRefund === true;
}

export function monthSummary(transactions: readonly Transaction[], ym: YearMonth): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (!inMonth(tx, ym)) continue;
    if (tx.type === 'expense') expense += tx.amount;
    else if (isRefund(tx)) expense -= tx.amount;
    else if (tx.type === 'income') income += tx.amount;
  }
  return { income, expense, net: income - expense };
}

/** Pengeluaran bersih per kategori pengeluaran (bisa negatif jika refund > belanja). */
export function expenseByCategory(
  transactions: readonly Transaction[],
  ym: YearMonth,
): Map<ID, Rupiah> {
  const totals = new Map<ID, Rupiah>();
  for (const tx of transactions) {
    if (!inMonth(tx, ym) || !tx.categoryId) continue;
    const sign = tx.type === 'expense' ? 1 : isRefund(tx) ? -1 : 0;
    if (sign === 0) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + sign * tx.amount);
  }
  return totals;
}

/** Ringkasan `months` bulan terakhir yang berakhir di `endMonth`, urut lama → baru. */
export function monthlyTrend(
  transactions: readonly Transaction[],
  endMonth: YearMonth,
  months = 6,
): Array<MonthSummary & { month: YearMonth }> {
  const result: Array<MonthSummary & { month: YearMonth }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = addMonths(endMonth, -i);
    result.push({ month, ...monthSummary(transactions, month) });
  }
  return result;
}

export interface PeriodChange {
  /** current − previous. */
  delta: Rupiah;
  /** delta ÷ |previous|; null jika bulan sebelumnya 0 (tidak bisa dibandingkan). */
  ratio: number | null;
}

export function compareValues(current: Rupiah, previous: Rupiah): PeriodChange {
  const delta = current - previous;
  return { delta, ratio: previous === 0 ? null : delta / Math.abs(previous) };
}

export interface CategoryShare {
  categoryId: ID;
  amount: Rupiah;
  /** Bagian dari total pengeluaran positif; 0 jika total 0. */
  share: number;
}

/**
 * Pengeluaran per kategori diurutkan dari terbesar. Kategori bernilai 0 tidak
 * ditampilkan; kategori negatif (refund > belanja) tetap ditampilkan di akhir.
 */
export function categoryBreakdown(transactions: readonly Transaction[], ym: YearMonth): CategoryShare[] {
  const totals = expenseByCategory(transactions, ym);
  const positiveTotal = [...totals.values()].filter((v) => v > 0).reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([categoryId, amount]) => ({
      categoryId,
      amount,
      share: positiveTotal > 0 && amount > 0 ? amount / positiveTotal : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}
