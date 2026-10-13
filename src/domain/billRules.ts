// Validasi dan pengelompokan tagihan rutin (PRD §8.6, §9.9).

import { addMonths, diffDays, isValidYearMonth, toYearMonth } from '../lib/date';
import { isValidAmount } from '../lib/money';
import { billOccurrences, type BillOccurrence } from './bills';
import type { Account, Bill, BillSkip, Category, ID, LocalDate, Transaction } from './types';

export const MAX_BILL_NAME = 40;

export type BillDraft = Omit<Bill, 'active'> & { active?: boolean };
export type BillErrors = Partial<Record<keyof Bill, string>>;

export function validateBill(
  draft: BillDraft,
  ctx: { accountsById: ReadonlyMap<ID, Account>; categoriesById: ReadonlyMap<ID, Category>; isNew: boolean },
): BillErrors {
  const errors: BillErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Nama tagihan wajib diisi.';
  else if (name.length > MAX_BILL_NAME) errors.name = `Nama tagihan maksimal ${MAX_BILL_NAME} karakter.`;

  if (!isValidAmount(draft.amount)) {
    errors.amount = draft.isVariable
      ? 'Masukkan perkiraan nominal (minimal Rp1).'
      : 'Nominal harus bilangan bulat antara Rp1 dan Rp1.000.000.000.000.';
  }

  if (!Number.isInteger(draft.dueDay) || draft.dueDay < 1 || draft.dueDay > 31) {
    errors.dueDay = 'Tanggal jatuh tempo harus 1–31.';
  }

  const payer = ctx.accountsById.get(draft.accountId);
  if (!payer) errors.accountId = 'Pilih akun pembayar.';
  else if (ctx.isNew && payer.archived) errors.accountId = `Akun ${payer.name} sudah diarsipkan.`;

  if (draft.kind === 'expense') {
    const category = draft.categoryId ? ctx.categoriesById.get(draft.categoryId) : undefined;
    if (!category || category.type !== 'expense') errors.categoryId = 'Pilih kategori pengeluaran.';
  } else {
    const target = draft.toAccountId ? ctx.accountsById.get(draft.toAccountId) : undefined;
    if (!target) errors.toAccountId = 'Pilih akun tujuan.';
    else if (target.id === draft.accountId) errors.toAccountId = 'Akun tujuan harus berbeda dari akun pembayar.';
    else if (ctx.isNew && target.archived) errors.toAccountId = `Akun ${target.name} sudah diarsipkan.`;
  }

  if (!isValidYearMonth(draft.startMonth)) errors.startMonth = 'Bulan mulai tidak valid.';
  if (draft.endMonth !== undefined) {
    if (!isValidYearMonth(draft.endMonth)) errors.endMonth = 'Bulan berakhir tidak valid.';
    else if (draft.endMonth < draft.startMonth) errors.endMonth = 'Bulan berakhir tidak boleh sebelum bulan mulai.';
  }

  if (draft.note && draft.note.length > 200) errors.note = 'Catatan maksimal 200 karakter.';
  return errors;
}

export interface BillsOverview {
  overdue: BillOccurrence[];
  thisMonth: BillOccurrence[];
  nextMonth: BillOccurrence[];
}

/** Kelompok layar Tagihan: Terlambat (bulan mana pun), Bulan ini (semua status), Bulan depan. */
export function billsOverview(
  bills: readonly Bill[],
  transactions: readonly Transaction[],
  skips: readonly BillSkip[],
  today: LocalDate,
): BillsOverview {
  const thisMonth = toYearMonth(today);
  const nextMonth = addMonths(thisMonth, 1);
  const all = billOccurrences(bills, transactions, skips, today, nextMonth);
  return {
    overdue: all.filter((o) => o.status === 'overdue'),
    thisMonth: all.filter((o) => o.period === thisMonth && o.status !== 'overdue'),
    nextMonth: all.filter((o) => o.period === nextMonth),
  };
}

/** Jumlah hari keterlambatan (≥ 1 untuk tagihan terlambat). */
export function daysLate(occurrence: BillOccurrence, today: LocalDate): number {
  return Math.max(0, diffDays(occurrence.dueDate, today));
}

/** Ada pembayaran yang merujuk tagihan ini (tagihan tidak boleh dihapus, cukup dinonaktifkan). */
export function billHasPayments(billId: ID, transactions: readonly Transaction[]): boolean {
  return transactions.some((tx) => tx.billId === billId);
}
