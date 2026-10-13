import { describe, expect, it } from 'vitest';
import { ACCOUNTS, BCA, CATEGORIES, makeAccount, makeCategory, makeTx } from '../test/factories';
import {
  validateArchiveAccount,
  validateOpeningDate,
  validateTransaction,
  type TransactionDraft,
} from './validation';

const TODAY = '2026-10-13';
const ctx = (over: Partial<Parameters<typeof validateTransaction>[1]> = {}) => ({
  accountsById: new Map(ACCOUNTS.map((a) => [a.id, a])),
  categoriesById: new Map(CATEGORIES.map((c) => [c.id, c])),
  today: TODAY,
  isNew: true,
  ...over,
});
const expense = (over: Partial<TransactionDraft> = {}): TransactionDraft => ({
  id: 'x',
  type: 'expense',
  date: TODAY,
  amount: 50_000,
  accountId: 'bca',
  categoryId: 'makan',
  ...over,
});

describe('Validasi transaksi', () => {
  it('transaksi valid tidak punya error', () => {
    expect(validateTransaction(expense(), ctx())).toEqual({});
  });

  it('QA-21 menolak tanggal masa depan', () => {
    expect(validateTransaction(expense({ date: '2026-10-14' }), ctx()).date).toMatch(/setelah hari ini/);
  });

  it('QA-21 menolak tanggal sebelum saldo awal akun', () => {
    const bca = makeAccount({ id: 'bca', name: 'BCA', openingDate: '2026-10-01' });
    const errors = validateTransaction(
      expense({ date: '2026-09-30' }),
      ctx({ accountsById: new Map([['bca', bca]]) }),
    );
    expect(errors.date).toBe(
      'Tanggal sebelum saldo awal akun BCA (1 Okt 2026). Ubah tanggal saldo awal di pengaturan akun untuk mencatat transaksi lama.',
    );
  });

  it('memeriksa tanggal saldo awal akun tujuan transfer', () => {
    const gopay = makeAccount({ id: 'gopay', name: 'GoPay', openingDate: '2026-10-05' });
    const errors = validateTransaction(
      { id: 'x', type: 'transfer', date: '2026-10-02', amount: 1, accountId: 'bca', toAccountId: 'gopay' },
      ctx({ accountsById: new Map([['bca', BCA], ['gopay', gopay]]) }),
    );
    expect(errors.date).toMatch(/GoPay/);
  });

  it.each([0, -5, 1.5, 1_000_000_000_001, Number.NaN])('menolak nominal %s', (amount) => {
    expect(validateTransaction(expense({ amount }), ctx()).amount).toBeDefined();
  });

  it('menolak tanggal yang tidak ada', () => {
    expect(validateTransaction(expense({ date: '2026-02-30' }), ctx()).date).toBe('Tanggal tidak valid.');
  });

  it('transfer: akun asal dan tujuan harus berbeda', () => {
    const errors = validateTransaction(
      { id: 'x', type: 'transfer', date: TODAY, amount: 1, accountId: 'bca', toAccountId: 'bca' },
      ctx(),
    );
    expect(errors.toAccountId).toMatch(/berbeda/);
  });

  it('transfer tanpa akun tujuan ditolak', () => {
    const errors = validateTransaction({ id: 'x', type: 'transfer', date: TODAY, amount: 1, accountId: 'bca' }, ctx());
    expect(errors.toAccountId).toBe('Pilih akun.');
  });

  it('kategori wajib dan jenisnya harus cocok', () => {
    expect(validateTransaction(expense({ categoryId: undefined }), ctx()).categoryId).toBe('Pilih kategori.');
    expect(validateTransaction(expense({ categoryId: 'gaji' }), ctx()).categoryId).toBe('Jenis kategori tidak sesuai.');
    const income = { ...expense({ type: 'income', categoryId: 'gaji' }) };
    expect(validateTransaction(income, ctx())).toEqual({});
  });

  it('refund wajib memakai kategori pengeluaran', () => {
    const refund = expense({ type: 'income', isRefund: true, categoryId: 'gaji' });
    expect(validateTransaction(refund, ctx()).categoryId).toMatch(/Refund/);
    expect(validateTransaction({ ...refund, categoryId: 'makan' }, ctx())).toEqual({});
  });

  it('transaksi baru tidak boleh memakai akun/kategori terarsip, tetapi edit boleh', () => {
    const lama = makeAccount({ id: 'lama', name: 'Lama', archived: true });
    const arsip = makeCategory({ id: 'arsip', name: 'Arsip', type: 'expense', archived: true });
    const c = ctx({
      accountsById: new Map([['lama', lama]]),
      categoriesById: new Map([['arsip', arsip]]),
    });
    const draft = expense({ accountId: 'lama', categoryId: 'arsip' });
    expect(validateTransaction(draft, c)).toMatchObject({ accountId: expect.any(String), categoryId: expect.any(String) });
    expect(validateTransaction(draft, { ...c, isNew: false })).toEqual({});
  });

  it('penyesuaian wajib punya arah; catatan dibatasi 200 karakter', () => {
    const adj: TransactionDraft = { id: 'x', type: 'adjustment', date: TODAY, amount: 1, accountId: 'bca' };
    expect(validateTransaction(adj, ctx()).adjustDirection).toBeDefined();
    expect(validateTransaction(expense({ note: 'a'.repeat(201) }), ctx()).note).toBeDefined();
    expect(validateTransaction(expense({ note: 'a'.repeat(200) }), ctx())).toEqual({});
  });
});

describe('Validasi akun', () => {
  it('QA-22 arsip akun bersaldo Rp10.000 ditolak', () => {
    expect(validateArchiveAccount(BCA, 10_000)).toMatch(/Sesuaikan saldo atau Transfer/);
    expect(validateArchiveAccount(BCA, 0)).toBeNull();
  });

  it('tanggal saldo awal tidak boleh setelah transaksi tertua', () => {
    const txs = [
      makeTx({ type: 'transfer', amount: 1, accountId: 'gopay', toAccountId: 'bca', date: '2026-10-03' }),
      makeTx({ type: 'expense', amount: 1, accountId: 'bca', date: '2026-10-08' }),
    ];
    expect(validateOpeningDate('bca', '2026-10-05', txs)).toMatch(/3 Okt 2026/);
    expect(validateOpeningDate('bca', '2026-10-03', txs)).toBeNull();
    expect(validateOpeningDate('kartu', '2026-12-01', txs)).toBeNull();
  });
});
