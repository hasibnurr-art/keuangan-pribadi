// Tagihan rutin bulanan dan "Uang tersedia" (PRD §8.4, §8.6).

import {
  addDays,
  clampedDate,
  lastDayOfMonth,
  monthsBetween,
  toYearMonth,
} from '../lib/date';
import type {
  Account,
  Bill,
  BillSkip,
  ID,
  LocalDate,
  Rupiah,
  Transaction,
  YearMonth,
} from './types';

export type BillStatus = 'paid' | 'skipped' | 'overdue' | 'upcoming';

export interface BillOccurrence {
  bill: Bill;
  period: YearMonth;
  dueDate: LocalDate;
  status: BillStatus;
  /** Transaksi pembayaran, jika sudah dibayar. */
  payment?: Transaction;
}

export function billDueDate(bill: Bill, period: YearMonth): LocalDate {
  return clampedDate(period, bill.dueDay);
}

const key = (billId: ID, period: YearMonth) => `${billId}|${period}`;

/**
 * Semua kejadian tagihan dari `startMonth` sampai `untilMonth` (dibatasi `endMonth`).
 * Tagihan nonaktif hanya mengembalikan kejadian yang sudah dibayar/dilewati (riwayat).
 */
export function billOccurrences(
  bills: readonly Bill[],
  transactions: readonly Transaction[],
  skips: readonly BillSkip[],
  today: LocalDate,
  untilMonth: YearMonth,
): BillOccurrence[] {
  const payments = new Map<string, Transaction>();
  for (const tx of transactions) {
    if (tx.billId && tx.billPeriod) payments.set(key(tx.billId, tx.billPeriod), tx);
  }
  const skipped = new Set(skips.map((s) => key(s.billId, s.period)));

  const result: BillOccurrence[] = [];
  for (const bill of bills) {
    const last = bill.endMonth && bill.endMonth < untilMonth ? bill.endMonth : untilMonth;
    for (const period of monthsBetween(bill.startMonth, last)) {
      const dueDate = billDueDate(bill, period);
      const payment = payments.get(key(bill.id, period));
      let status: BillStatus;
      if (payment) status = 'paid';
      else if (skipped.has(key(bill.id, period))) status = 'skipped';
      else if (!bill.active) continue;
      else status = dueDate < today ? 'overdue' : 'upcoming';
      result.push({ bill, period, dueDate, status, payment });
    }
  }
  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export const isUnpaid = (o: BillOccurrence) => o.status === 'overdue' || o.status === 'upcoming';

/** Tagihan terlambat + jatuh tempo dalam `horizonDays` hari ke depan (dashboard). */
export function dueSoon(
  bills: readonly Bill[],
  transactions: readonly Transaction[],
  skips: readonly BillSkip[],
  today: LocalDate,
  horizonDays = 14,
): BillOccurrence[] {
  const horizon = addDays(today, horizonDays);
  return billOccurrences(bills, transactions, skips, today, toYearMonth(horizon)).filter(
    (o) => isUnpaid(o) && o.dueDate <= horizon,
  );
}

export interface AvailableMoney {
  totalCash: Rupiah;
  /** Tagihan kas yang belum dibayar s.d. akhir bulan ini (termasuk yang terlambat). */
  pendingBills: BillOccurrence[];
  pendingTotal: Rupiah;
  available: Rupiah;
}

/**
 * Uang tersedia = total kas − tagihan belum dibayar/dilewati yang jatuh tempo ≤ akhir
 * bulan ini dan dibayar dari akun aset aktif yang dihitung di Uang tersedia.
 */
export function availableMoney(
  accounts: readonly Account[],
  totalCash: Rupiah,
  bills: readonly Bill[],
  transactions: readonly Transaction[],
  skips: readonly BillSkip[],
  today: LocalDate,
): AvailableMoney {
  const cashAccountIds = new Set(
    accounts
      .filter((a) => a.group === 'asset' && a.includeInAvailable && !a.archived)
      .map((a) => a.id),
  );
  const thisMonth = toYearMonth(today);
  const endOfMonth = lastDayOfMonth(thisMonth);
  const pendingBills = billOccurrences(bills, transactions, skips, today, thisMonth).filter(
    (o) => isUnpaid(o) && o.dueDate <= endOfMonth && cashAccountIds.has(o.bill.accountId),
  );
  const pendingTotal = pendingBills.reduce((sum, o) => sum + o.bill.amount, 0);
  return { totalCash, pendingBills, pendingTotal, available: totalCash - pendingTotal };
}
