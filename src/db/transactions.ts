// Penulisan transaksi. Semua operasi multi-record berjalan dalam satu
// `db.transaction` sehingga tersimpan seluruhnya atau tidak sama sekali.

import {
  hasErrors,
  validateTransaction,
  type FieldErrors,
  type TransactionDraft,
} from '../domain/validation';
import type { ID, LocalDate, Rupiah, Transaction } from '../domain/types';
import { isValidYearMonth } from '../lib/date';
import type { KeuanganDB } from './schema';

export class ValidationError extends Error {
  readonly errors: FieldErrors;
  constructor(errors: FieldErrors) {
    super(Object.values(errors).join(' '));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/** Biaya tambahan pada transfer, disimpan sebagai pengeluaran terpisah dalam grup yang sama. */
export interface FeeInput {
  amount: Rupiah;
  categoryId: ID;
}

export interface SaveOptions {
  today: LocalDate;
  fee?: FeeInput | null;
  now?: Date;
}

export const feeIdFor = (transferId: ID) => `${transferId}-fee`;

/** Hapus properti bernilai undefined agar record yang disimpan konsisten. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export async function touchData(db: KeuanganDB, now: Date = new Date()): Promise<void> {
  await db.settings.put({ key: 'lastDataChangeAt', value: now.toISOString() });
}

/**
 * Simpan transaksi baru atau perubahan. ID dibuat saat form dibuka, sehingga
 * menyimpan draft yang sama dua kali tidak membuat duplikat.
 */
export async function saveTransaction(
  db: KeuanganDB,
  draft: TransactionDraft,
  { today, fee = null, now = new Date() }: SaveOptions,
): Promise<Transaction[]> {
  return db.transaction('rw', [db.accounts, db.categories, db.transactions, db.bills, db.settings], async () => {
    const existing = await db.transactions.get(draft.id);
    if (existing && existing.type !== draft.type) {
      throw new ValidationError({
        type: 'Jenis transaksi tidak bisa diubah. Hapus lalu buat transaksi baru.',
      });
    }

    const [accounts, categories] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
    ]);
    const ctx = {
      accountsById: new Map(accounts.map((a) => [a.id, a])),
      categoriesById: new Map(categories.map((c) => [c.id, c])),
      today,
      isNew: !existing,
    };

    const isTransfer = draft.type === 'transfer';
    if (fee && !isTransfer) {
      throw new ValidationError({ fee: 'Biaya tambahan hanya untuk transfer.' });
    }

    const errors = validateTransaction(draft, ctx);
    let feeDraft: TransactionDraft | null = null;
    if (fee) {
      feeDraft = {
        id: feeIdFor(draft.id),
        type: 'expense',
        date: draft.date,
        amount: fee.amount,
        accountId: draft.accountId,
        categoryId: fee.categoryId,
        groupId: draft.id,
      };
      const feeErrors = validateTransaction(feeDraft, ctx);
      if (feeErrors.amount || feeErrors.categoryId) {
        errors.fee = feeErrors.amount ?? feeErrors.categoryId;
      }
    }
    if (draft.billId !== undefined) {
      const bill = await db.bills.get(draft.billId);
      if (!bill || !draft.billPeriod || !isValidYearMonth(draft.billPeriod)) {
        errors.billId = 'Tagihan untuk pembayaran ini tidak ditemukan.';
      }
    }
    if (hasErrors(errors)) throw new ValidationError(errors);

    const timestamp = now.toISOString();
    const main: Transaction = compact({
      ...draft,
      groupId: isTransfer ? (feeDraft ? draft.id : undefined) : draft.groupId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    const oldFee = feeDraft ? await db.transactions.get(feeDraft.id) : undefined;
    if (isTransfer && existing?.groupId) {
      const oldMembers = await db.transactions.where('groupId').equals(existing.groupId).primaryKeys();
      await db.transactions.bulkDelete(oldMembers.filter((id) => id !== draft.id));
    }

    const saved: Transaction[] = [main];
    if (feeDraft) {
      saved.push(
        compact({
          ...feeDraft,
          createdAt: oldFee?.createdAt ?? timestamp,
          updatedAt: timestamp,
        }),
      );
    }

    await db.transactions.bulkPut(saved);
    await touchData(db, now);
    return saved;
  });
}

/**
 * Hapus transaksi beserta seluruh anggota grupnya (transfer + biaya).
 * Mengembalikan record yang dihapus untuk keperluan undo.
 */
export async function deleteTransaction(
  db: KeuanganDB,
  id: ID,
  now: Date = new Date(),
): Promise<Transaction[]> {
  return db.transaction('rw', [db.transactions, db.settings], async () => {
    const tx = await db.transactions.get(id);
    if (!tx) return [];
    const records = tx.groupId
      ? await db.transactions.where('groupId').equals(tx.groupId).toArray()
      : [tx];
    await db.transactions.bulkDelete(records.map((r) => r.id));
    await touchData(db, now);
    return records;
  });
}

/** Transaksi beserta anggota grupnya (untuk undo edit). */
export async function getTransactionGroup(db: KeuanganDB, id: ID): Promise<Transaction[]> {
  const tx = await db.transactions.get(id);
  if (!tx) return [];
  return tx.groupId ? db.transactions.where('groupId').equals(tx.groupId).toArray() : [tx];
}

/** Undo simpan: hapus record hasil simpan lalu kembalikan kondisi sebelumnya. */
export async function undoSave(
  db: KeuanganDB,
  saved: readonly Transaction[],
  previous: readonly Transaction[],
  now: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', [db.transactions, db.settings], async () => {
    await db.transactions.bulkDelete(saved.map((t) => t.id));
    await db.transactions.bulkPut([...previous]);
    await touchData(db, now);
  });
}

/** Undo hapus: kembalikan record identik, termasuk ID-nya. */
export async function restoreTransactions(
  db: KeuanganDB,
  records: readonly Transaction[],
  now: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', [db.transactions, db.settings], async () => {
    await db.transactions.bulkPut([...records]);
    await touchData(db, now);
  });
}
