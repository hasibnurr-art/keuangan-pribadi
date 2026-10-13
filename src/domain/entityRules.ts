// Validasi akun dan kategori (PRD §7, §8.7, §9.2, §9.6).

import { isValidLocalDate } from '../lib/date';
import { MAX_AMOUNT, type Account, type Category, type ID, type LocalDate, type Transaction } from './types';
import { validateOpeningDate } from './validation';

export const MAX_ACCOUNT_NAME = 40;
export const MAX_CATEGORY_NAME = 30;

export type AccountDraft = Pick<
  Account,
  'id' | 'name' | 'group' | 'kind' | 'openingBalance' | 'openingDate' | 'includeInAvailable'
>;

export type AccountErrors = Partial<Record<'name' | 'group' | 'openingBalance' | 'openingDate', string>>;

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('id') === b.trim().toLocaleLowerCase('id');

export function validateAccount(
  draft: AccountDraft,
  ctx: { accounts: readonly Account[]; transactions: readonly Transaction[]; today: LocalDate },
): AccountErrors {
  const errors: AccountErrors = {};
  const name = draft.name.trim();
  const existing = ctx.accounts.find((a) => a.id === draft.id);

  if (!name) errors.name = 'Nama akun wajib diisi.';
  else if (name.length > MAX_ACCOUNT_NAME) errors.name = `Nama akun maksimal ${MAX_ACCOUNT_NAME} karakter.`;
  else if (ctx.accounts.some((a) => a.id !== draft.id && !a.archived && sameName(a.name, name))) {
    errors.name = 'Sudah ada akun aktif dengan nama ini.';
  }

  if (
    !Number.isInteger(draft.openingBalance) ||
    draft.openingBalance < 0 ||
    draft.openingBalance > MAX_AMOUNT
  ) {
    errors.openingBalance = 'Saldo awal harus bilangan bulat Rp0 atau lebih.';
  }

  if (!isValidLocalDate(draft.openingDate)) {
    errors.openingDate = 'Tanggal tidak valid.';
  } else if (draft.openingDate > ctx.today) {
    errors.openingDate = 'Tanggal saldo awal tidak boleh setelah hari ini.';
  } else if (existing) {
    const error = validateOpeningDate(draft.id, draft.openingDate, ctx.transactions);
    if (error) errors.openingDate = error;
  }

  if (existing && existing.group !== draft.group && hasTransactions(draft.id, ctx.transactions)) {
    errors.group = 'Kelompok akun tidak bisa diubah karena sudah ada transaksi.';
  }

  return errors;
}

export function hasTransactions(accountId: ID, transactions: readonly Transaction[]): boolean {
  return transactions.some((tx) => tx.accountId === accountId || tx.toAccountId === accountId);
}

export type CategoryDraft = Pick<Category, 'id' | 'name' | 'type' | 'icon' | 'color'>;

export function validateCategory(draft: CategoryDraft, categories: readonly Category[]): { name?: string } {
  const name = draft.name.trim();
  if (!name) return { name: 'Nama kategori wajib diisi.' };
  if (name.length > MAX_CATEGORY_NAME) return { name: `Nama kategori maksimal ${MAX_CATEGORY_NAME} karakter.` };
  const duplicate = categories.some(
    (c) => c.id !== draft.id && c.type === draft.type && !c.archived && sameName(c.name, name),
  );
  return duplicate ? { name: 'Sudah ada kategori aktif dengan nama ini.' } : {};
}

/** Minimal harus tersisa 1 kategori aktif per jenis. */
export function validateArchiveCategory(category: Category, categories: readonly Category[]): string | null {
  const otherActive = categories.some((c) => c.id !== category.id && c.type === category.type && !c.archived);
  return otherActive ? null : 'Minimal harus ada 1 kategori aktif untuk jenis ini.';
}
