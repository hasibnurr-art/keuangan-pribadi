// Riwayat transaksi: pencarian, filter, dan pengelompokan per tanggal (PRD §9.7).

import { addDays, toYearMonth } from '../lib/date';
import { isRefund } from './report';
import type {
  Account,
  Category,
  ID,
  LocalDate,
  Rupiah,
  Transaction,
  TransactionType,
  YearMonth,
} from './types';

export interface HistoryFilter {
  query?: string;
  month?: YearMonth;
  type?: TransactionType;
  accountId?: ID;
  categoryId?: ID;
}

export function activeFilterCount(filter: HistoryFilter): number {
  return [filter.month, filter.type, filter.accountId, filter.categoryId].filter(Boolean).length;
}

const normalize = (s: string) => s.toLocaleLowerCase('id').trim();

export function filterTransactions(
  transactions: readonly Transaction[],
  filter: HistoryFilter,
  accountsById: ReadonlyMap<ID, Account>,
  categoriesById: ReadonlyMap<ID, Category>,
): Transaction[] {
  const query = filter.query ? normalize(filter.query) : '';
  return transactions.filter((tx) => {
    if (filter.month && toYearMonth(tx.date) !== filter.month) return false;
    if (filter.type && tx.type !== filter.type) return false;
    if (filter.accountId && tx.accountId !== filter.accountId && tx.toAccountId !== filter.accountId) {
      return false;
    }
    if (filter.categoryId && tx.categoryId !== filter.categoryId) return false;
    if (query) {
      const haystack = [
        tx.note,
        tx.categoryId && categoriesById.get(tx.categoryId)?.name,
        accountsById.get(tx.accountId)?.name,
        tx.toAccountId && accountsById.get(tx.toAccountId)?.name,
      ]
        .filter(Boolean)
        .map((s) => normalize(s as string))
        .join(' ');
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Urutan tampil: tanggal terbaru dulu, lalu yang dibuat terakhir. */
export function sortNewestFirst(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export interface DayGroup {
  date: LocalDate;
  transactions: Transaction[];
  /** Pengeluaran bersih hari itu (pengeluaran − refund). */
  expenseTotal: Rupiah;
}

export function groupByDate(sorted: readonly Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const tx of sorted) {
    let group = groups.at(-1);
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, transactions: [], expenseTotal: 0 };
      groups.push(group);
    }
    group.transactions.push(tx);
    if (tx.type === 'expense') group.expenseTotal += tx.amount;
    else if (isRefund(tx)) group.expenseTotal -= tx.amount;
  }
  return groups;
}

/** Kategori diurutkan dari yang paling sering dipakai 30 hari terakhir, lalu sortOrder. */
export function sortCategoriesByUsage(
  categories: readonly Category[],
  transactions: readonly Transaction[],
  today: LocalDate,
): Category[] {
  const since = addDays(today, -30);
  const usage = new Map<ID, number>();
  for (const tx of transactions) {
    if (tx.categoryId && tx.date >= since && tx.date <= today) {
      usage.set(tx.categoryId, (usage.get(tx.categoryId) ?? 0) + 1);
    }
  }
  return [...categories].sort(
    (a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.sortOrder - b.sortOrder,
  );
}

/** Daftar bulan yang punya transaksi, terbaru dulu. */
export function monthsWithTransactions(transactions: readonly Transaction[]): YearMonth[] {
  return [...new Set(transactions.map((tx) => toYearMonth(tx.date)))].sort().reverse();
}
