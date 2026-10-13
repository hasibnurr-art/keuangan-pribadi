// Pembuat data uji. Skenario standar: BCA, GoPay, Kartu BCA, Pinjaman.

import type { Account, Bill, Category, Transaction } from '../domain/types';

let seq = 0;
const nextId = (prefix: string) => `${prefix}${++seq}`;

export function makeAccount(over: Partial<Account> & Pick<Account, 'id'>): Account {
  const group = over.group ?? 'asset';
  return {
    name: over.id,
    group,
    kind: group === 'asset' ? 'bank' : 'credit_card',
    openingBalance: 0,
    openingDate: '2026-01-01',
    includeInAvailable: group === 'asset',
    archived: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

export function makeCategory(over: Partial<Category> & Pick<Category, 'id' | 'type'>): Category {
  return { name: over.id, icon: '📦', color: 'slate', archived: false, sortOrder: 0, ...over };
}

export function makeTx(
  over: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'accountId'>,
): Transaction {
  return {
    id: nextId('t'),
    date: '2026-10-10',
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
    ...over,
  };
}

export function makeBill(
  over: Partial<Bill> & Pick<Bill, 'id' | 'amount' | 'dueDay' | 'accountId'>,
): Bill {
  return {
    name: over.id,
    kind: 'expense',
    isVariable: false,
    startMonth: '2026-10',
    active: true,
    ...over,
  };
}

export const BCA = makeAccount({ id: 'bca', name: 'BCA', kind: 'bank' });
export const GOPAY = makeAccount({ id: 'gopay', name: 'GoPay', kind: 'ewallet' });
export const KARTU = makeAccount({ id: 'kartu', name: 'Kartu BCA', group: 'liability', kind: 'credit_card' });
export const PINJAMAN = makeAccount({ id: 'pinjaman', name: 'Pinjaman', group: 'liability', kind: 'loan' });
export const ACCOUNTS = [BCA, GOPAY, KARTU, PINJAMAN];

export const MAKAN = makeCategory({ id: 'makan', name: 'Makan & Minum', type: 'expense' });
export const BIAYA = makeCategory({ id: 'biaya', name: 'Bunga & Biaya Admin', type: 'expense' });
export const GAJI = makeCategory({ id: 'gaji', name: 'Gaji', type: 'income' });
export const CATEGORIES = [MAKAN, BIAYA, GAJI];
