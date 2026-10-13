// Skema IndexedDB (PRD §7). Setiap perubahan skema WAJIB menambah versi Dexie,
// fungsi migrasi, dan fixture backup + tes migrasi.

import Dexie, { type EntityTable } from 'dexie';
import type {
  Account,
  Bill,
  BillSkip,
  BudgetLimit,
  Category,
  Goal,
  Setting,
  Transaction,
} from '../domain/types';

export const SCHEMA_VERSION = 2;

export class KeuanganDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  budgetLimits!: EntityTable<BudgetLimit, 'id'>;
  bills!: EntityTable<Bill, 'id'>;
  billSkips!: Dexie.Table<BillSkip, [string, string]>;
  settings!: EntityTable<Setting, 'key'>;
  goals!: EntityTable<Goal, 'id'>;

  constructor(name = 'keuangan-pribadi') {
    super(name);
    this.version(1).stores({
      accounts: 'id, group, archived',
      categories: 'id, type, archived',
      transactions: 'id, date, type, accountId, toAccountId, categoryId, groupId, [billId+billPeriod]',
      budgetLimits: 'id, categoryId, effectiveFrom',
      bills: 'id, active',
      billSkips: '[billId+period]',
      settings: 'key',
    });
    // v2: target tabungan.
    this.version(2).stores({
      goals: 'id, accountId, archived',
    });
  }
}

export const DATA_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgetLimits',
  'bills',
  'billSkips',
  'settings',
  'goals',
] as const;
