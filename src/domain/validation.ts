// Validasi aturan bisnis (PRD §8.7). Mengembalikan pesan per field untuk UI.

import { formatDisplayDate } from '../lib/format';
import { isValidLocalDate } from '../lib/date';
import { isValidAmount } from '../lib/money';
import {
  MAX_NOTE_LENGTH,
  type Account,
  type Category,
  type ID,
  type LocalDate,
  type Rupiah,
  type Transaction,
} from './types';

export type FieldErrors = Partial<Record<keyof Transaction | 'fee', string>>;

export interface ValidationContext {
  accountsById: ReadonlyMap<ID, Account>;
  categoriesById: ReadonlyMap<ID, Category>;
  today: LocalDate;
  /** Transaksi baru tidak boleh memakai akun/kategori terarsip. */
  isNew: boolean;
}

export type TransactionDraft = Omit<Transaction, 'createdAt' | 'updatedAt'>;

export function validateTransaction(draft: TransactionDraft, ctx: ValidationContext): FieldErrors {
  const errors: FieldErrors = {};

  if (!isValidAmount(draft.amount)) {
    errors.amount = 'Nominal harus bilangan bulat antara Rp1 dan Rp1.000.000.000.000.';
  }

  if (!isValidLocalDate(draft.date)) {
    errors.date = 'Tanggal tidak valid.';
  } else if (draft.date > ctx.today) {
    errors.date = 'Tanggal tidak boleh setelah hari ini. Gunakan Tagihan untuk rencana.';
  }

  const checkAccount = (field: 'accountId' | 'toAccountId', id: ID | undefined) => {
    const account = id ? ctx.accountsById.get(id) : undefined;
    if (!account) {
      errors[field] = 'Pilih akun.';
    } else if (ctx.isNew && account.archived) {
      errors[field] = `Akun ${account.name} sudah diarsipkan.`;
    } else if (!errors.date && isValidLocalDate(draft.date) && draft.date < account.openingDate) {
      errors.date =
        `Tanggal sebelum saldo awal akun ${account.name} (${formatDisplayDate(account.openingDate)}). ` +
        'Ubah tanggal saldo awal di pengaturan akun untuk mencatat transaksi lama.';
    }
  };

  checkAccount('accountId', draft.accountId);

  if (draft.type === 'transfer') {
    checkAccount('toAccountId', draft.toAccountId);
    if (draft.toAccountId && draft.toAccountId === draft.accountId) {
      errors.toAccountId = 'Akun tujuan harus berbeda dari akun asal.';
    }
  }

  if (draft.type === 'income' || draft.type === 'expense') {
    const expected = draft.type === 'expense' || draft.isRefund ? 'expense' : 'income';
    const category = draft.categoryId ? ctx.categoriesById.get(draft.categoryId) : undefined;
    if (!category) {
      errors.categoryId = 'Pilih kategori.';
    } else if (category.type !== expected) {
      errors.categoryId = draft.isRefund
        ? 'Refund harus memakai kategori pengeluaran.'
        : 'Jenis kategori tidak sesuai.';
    } else if (ctx.isNew && category.archived) {
      errors.categoryId = `Kategori ${category.name} sudah diarsipkan.`;
    }
  }

  if (draft.type === 'adjustment' && !draft.adjustDirection) {
    errors.adjustDirection = 'Arah penyesuaian wajib diisi.';
  }

  if (draft.note && draft.note.length > MAX_NOTE_LENGTH) {
    errors.note = `Catatan maksimal ${MAX_NOTE_LENGTH} karakter.`;
  }

  return errors;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;

/** Akun hanya boleh diarsipkan jika saldonya Rp0. */
export function validateArchiveAccount(account: Account, balance: Rupiah): string | null {
  if (balance === 0) return null;
  return (
    `Saldo ${account.name} masih belum Rp0. ` +
    'Gunakan Sesuaikan saldo atau Transfer terlebih dahulu sebelum mengarsipkan.'
  );
}

/** Tanggal saldo awal tidak boleh dipindah setelah transaksi tertua akun tersebut. */
export function validateOpeningDate(
  accountId: ID,
  openingDate: LocalDate,
  transactions: readonly Transaction[],
): string | null {
  const earliest = transactions
    .filter((tx) => tx.accountId === accountId || tx.toAccountId === accountId)
    .reduce<LocalDate | null>((min, tx) => (min === null || tx.date < min ? tx.date : min), null);
  if (earliest !== null && openingDate > earliest) {
    return `Sudah ada transaksi pada ${formatDisplayDate(earliest)}. Tanggal saldo awal harus sama atau sebelum itu.`;
  }
  return null;
}
