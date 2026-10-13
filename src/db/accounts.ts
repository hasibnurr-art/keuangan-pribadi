// Operasi tulis akun (PRD §9.2, §9.5, §8.7).

import { planAdjustment } from '../domain/adjustment';
import { computeBalances } from '../domain/balance';
import {
  hasTransactions,
  validateAccount,
  type AccountDraft,
  type AccountErrors,
} from '../domain/entityRules';
import type { Account, ID, LocalDate, Rupiah, Transaction } from '../domain/types';
import { validateArchiveAccount } from '../domain/validation';
import type { KeuanganDB } from './schema';
import { ValidationError, saveTransaction, touchData } from './transactions';

export class AccountValidationError extends Error {
  readonly errors: AccountErrors;
  constructor(errors: AccountErrors) {
    super(Object.values(errors).join(' '));
    this.name = 'AccountValidationError';
    this.errors = errors;
  }
}

/** Buat atau ubah akun. ID dibuat saat form dibuka sehingga simpan ganda tidak menduplikasi. */
export async function saveAccount(
  db: KeuanganDB,
  draft: AccountDraft,
  { today, now = new Date() }: { today: LocalDate; now?: Date },
): Promise<Account> {
  return db.transaction('rw', [db.accounts, db.transactions, db.settings], async () => {
    const [accounts, transactions] = await Promise.all([db.accounts.toArray(), db.transactions.toArray()]);
    const errors = validateAccount(draft, { accounts, transactions, today });
    if (Object.keys(errors).length > 0) throw new AccountValidationError(errors);

    const existing = accounts.find((a) => a.id === draft.id);
    const timestamp = now.toISOString();
    const account: Account = {
      ...draft,
      name: draft.name.trim(),
      includeInAvailable: draft.group === 'asset' && draft.includeInAvailable,
      archived: existing?.archived ?? false,
      sortOrder: existing?.sortOrder ?? accounts.reduce((max, a) => Math.max(max, a.sortOrder + 1), 0),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await db.accounts.put(account);
    await touchData(db, now);
    return account;
  });
}

async function balanceOf(db: KeuanganDB, accountId: ID): Promise<{ account: Account; balance: Rupiah }> {
  const account = await db.accounts.get(accountId);
  if (!account) throw new Error('Akun tidak ditemukan.');
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .or('toAccountId')
    .equals(accountId)
    .toArray();
  const related = await relatedAccounts(db, transactions);
  const balance = computeBalances([account, ...related.filter((a) => a.id !== account.id)], transactions).get(accountId)!;
  return { account, balance };
}

async function relatedAccounts(db: KeuanganDB, transactions: readonly Transaction[]): Promise<Account[]> {
  const ids = new Set(transactions.flatMap((tx) => [tx.accountId, tx.toAccountId].filter(Boolean) as ID[]));
  return (await db.accounts.bulkGet([...ids])).filter((a): a is Account => !!a);
}

export async function setAccountArchived(
  db: KeuanganDB,
  accountId: ID,
  archived: boolean,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', [db.accounts, db.transactions, db.bills, db.settings], async () => {
    const { account, balance } = await balanceOf(db, accountId);
    if (archived) {
      const error = validateArchiveAccount(account, balance);
      if (error) throw new Error(error);
      const bill = (await db.bills.toArray()).find(
        (b) => b.active && (b.accountId === accountId || b.toAccountId === accountId),
      );
      if (bill) {
        throw new Error(`Akun masih dipakai tagihan aktif "${bill.name}". Nonaktifkan atau ubah tagihannya dulu.`);
      }
    }
    await db.accounts.put({ ...account, archived, updatedAt: now.toISOString() });
    await touchData(db, now);
  });
}

/** Akun hanya bisa dihapus jika belum punya transaksi dan tidak dipakai tagihan. */
export async function deleteAccount(db: KeuanganDB, accountId: ID, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', [db.accounts, db.transactions, db.bills, db.settings], async () => {
    const transactions = await db.transactions.toArray();
    if (hasTransactions(accountId, transactions)) {
      throw new Error('Akun yang sudah punya transaksi tidak bisa dihapus. Arsipkan saja.');
    }
    const usedByBill = (await db.bills.toArray()).some((b) => b.accountId === accountId || b.toAccountId === accountId);
    if (usedByBill) throw new Error('Akun masih dipakai oleh tagihan. Ubah atau hapus tagihannya dulu.');
    await db.accounts.delete(accountId);
    await touchData(db, now);
  });
}

/**
 * Sesuaikan saldo: catat selisih saldo aplikasi vs saldo sebenarnya sebagai
 * transaksi penyesuaian. Mengembalikan null jika tidak ada selisih.
 */
export async function adjustBalance(
  db: KeuanganDB,
  { id, accountId, actualBalance, today, now = new Date() }: {
    id: ID;
    accountId: ID;
    actualBalance: Rupiah;
    today: LocalDate;
    now?: Date;
  },
): Promise<Transaction | null> {
  if (!Number.isInteger(actualBalance) || actualBalance < 0) {
    throw new ValidationError({ amount: 'Saldo sebenarnya harus bilangan bulat Rp0 atau lebih.' });
  }
  return db.transaction('rw', [db.accounts, db.categories, db.transactions, db.bills, db.settings], async () => {
    const { balance } = await balanceOf(db, accountId);
    const plan = planAdjustment(accountId, balance, actualBalance, today);
    if (!plan) return null;
    const [saved] = await saveTransaction(
      db,
      { id, type: 'adjustment', date: plan.date, amount: plan.amount, accountId, adjustDirection: plan.adjustDirection },
      { today, now },
    );
    return saved;
  });
}
