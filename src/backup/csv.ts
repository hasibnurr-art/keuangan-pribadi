// Ekspor CSV (PRD §9.13) untuk dibuka di Excel/Sheets. CSV BUKAN backup.

import type { Account, Category, ID, LocalDate, Transaction } from '../domain/types';

export const CSV_HEADER = ['Tanggal', 'Jenis', 'Akun', 'Akun Tujuan', 'Kategori', 'Refund', 'Nominal', 'Catatan'];
const SEPARATOR = ';';

const TYPE_LABEL = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  transfer: 'Transfer',
} as const;

/** Cegah formula injection: sel teks yang diawali = + - @ tab CR diberi prefiks '. */
export function sanitizeCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function transactionsToCsv(
  transactions: readonly Transaction[],
  accountsById: ReadonlyMap<ID, Account>,
  categoriesById: ReadonlyMap<ID, Category>,
  range: { from?: LocalDate; to?: LocalDate } = {},
): string {
  const rows = transactions
    .filter((t) => (!range.from || t.date >= range.from) && (!range.to || t.date <= range.to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const lines = [CSV_HEADER.join(SEPARATOR)];
  for (const t of rows) {
    const jenis =
      t.type === 'adjustment' ? `Penyesuaian ${t.adjustDirection === 'decrease' ? '−' : '+'}` : TYPE_LABEL[t.type];
    const cells = [
      t.date,
      jenis,
      accountsById.get(t.accountId)?.name ?? '',
      t.toAccountId ? (accountsById.get(t.toAccountId)?.name ?? '') : '',
      t.categoryId ? (categoriesById.get(t.categoryId)?.name ?? '') : '',
      t.isRefund ? 'Ya' : '',
      String(t.amount),
      t.note ?? '',
    ];
    lines.push(cells.map((c, i) => (i === 6 ? c : sanitizeCell(c))).join(SEPARATOR));
  }
  // BOM agar Excel berbahasa Indonesia membaca UTF-8 dengan benar.
  return `﻿${lines.join('\r\n')}\r\n`;
}
