// Satu langganan data reaktif untuk seluruh aplikasi. Semua angka keuangan
// dihitung lewat src/domain; komponen tidak menghitung sendiri.

import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { computeBalances, computeTotals, type BalanceTotals } from '../domain/balance';
import type { Account, Bill, BillSkip, BudgetLimit, Category, Goal, ID, LocalDate, Rupiah, Transaction } from '../domain/types';
import { db } from '../db';
import { getAllSettings, type SettingValues } from '../db/settings';
import { localDate } from '../lib/date';

export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgetLimits: BudgetLimit[];
  bills: Bill[];
  billSkips: BillSkip[];
  goals: Goal[];
  settings: SettingValues;
  today: LocalDate;
  balances: Map<ID, Rupiah>;
  totals: BalanceTotals;
  accountsById: Map<ID, Account>;
  categoriesById: Map<ID, Category>;
}

const bySortOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/** Tanggal lokal hari ini, diperbarui saat aplikasi dibuka kembali atau lewat tengah malam. */
export function useToday(): LocalDate {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const update = () => setToday(localDate());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}

export function useSettings(): SettingValues | undefined {
  return useLiveQuery(() => getAllSettings(db), []);
}

const DataContext = createContext<AppData | null>(null);

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  // Semua tabel dibaca dalam SATU transaksi baca: UI selalu menerima potret yang konsisten.
  // (Langganan terpisah per tabel bisa sesaat tidak sinkron saat restore/hapus semua,
  // misalnya akun sudah kosong tetapi transaksi belum.)
  const snapshot = useLiveQuery(
    () =>
      db.transaction('r', [db.accounts, db.categories, db.transactions, db.budgetLimits, db.bills, db.billSkips, db.goals, db.settings], async () => {
        const [accounts, categories, transactions, budgetLimits, bills, billSkips, goals, settings] = await Promise.all([
          db.accounts.toArray(),
          db.categories.toArray(),
          db.transactions.toArray(),
          db.budgetLimits.toArray(),
          db.bills.toArray(),
          db.billSkips.toArray(),
          db.goals.toArray(),
          getAllSettings(db),
        ]);
        return {
          accounts: accounts.sort(bySortOrder),
          categories: categories.sort(bySortOrder),
          transactions,
          budgetLimits,
          bills,
          billSkips,
          goals: goals.sort(bySortOrder),
          settings,
        };
      }),
    [],
  );
  const today = useToday();

  const data = useMemo<AppData | null>(() => {
    if (!snapshot) return null;
    const balances = computeBalances(snapshot.accounts, snapshot.transactions);
    return {
      ...snapshot,
      today,
      balances,
      totals: computeTotals(snapshot.accounts, balances),
      accountsById: new Map(snapshot.accounts.map((a) => [a.id, a])),
      categoriesById: new Map(snapshot.categories.map((c) => [c.id, c])),
    };
  }, [snapshot, today]);

  if (!data) return fallback;
  return <DataContext value={data}>{children}</DataContext>;
}

export function useData(): AppData {
  const data = use(DataContext);
  if (!data) throw new Error('useData harus dipakai di dalam DataProvider');
  return data;
}

/** Dipakai komponen yang bisa tampil di luar DataProvider (misalnya Money di onboarding). */
export function useOptionalData(): AppData | null {
  return use(DataContext);
}
