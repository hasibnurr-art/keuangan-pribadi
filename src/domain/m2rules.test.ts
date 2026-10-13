import { describe, expect, it } from 'vitest';
import { formatAmountInput, parseAmountInput } from '../lib/money';
import { ACCOUNTS, BCA, CATEGORIES, GAJI, MAKAN, makeAccount, makeCategory, makeTx } from '../test/factories';
import { DEFAULT_CATEGORIES, groupOfKind } from './defaults';
import { validateAccount, validateArchiveCategory, validateCategory, type AccountDraft } from './entityRules';
import {
  activeFilterCount,
  filterTransactions,
  groupByDate,
  monthsWithTransactions,
  sortCategoriesByUsage,
  sortNewestFirst,
} from './history';

const TODAY = '2026-10-13';

describe('Kategori default', () => {
  it('ID unik dan setiap jenis punya kategori', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_CATEGORIES.filter((c) => c.type === 'expense')).toHaveLength(14);
    expect(DEFAULT_CATEGORIES.filter((c) => c.type === 'income')).toHaveLength(6);
    expect(validateCategory(DEFAULT_CATEGORIES[0], DEFAULT_CATEGORIES)).toEqual({});
  });

  it('kelompok akun dari jenisnya', () => {
    expect(groupOfKind('ewallet')).toBe('asset');
    expect(groupOfKind('paylater')).toBe('liability');
  });
});

describe('Validasi akun', () => {
  const draft = (over: Partial<AccountDraft> = {}): AccountDraft => ({
    id: 'baru',
    name: 'Mandiri',
    group: 'asset',
    kind: 'bank',
    openingBalance: 0,
    openingDate: TODAY,
    includeInAvailable: true,
    ...over,
  });
  const ctx = { accounts: ACCOUNTS, transactions: [], today: TODAY };

  it('akun valid', () => {
    expect(validateAccount(draft(), ctx)).toEqual({});
  });

  it('nama wajib, maksimal 40 karakter, unik di antara akun aktif (tanpa peka huruf besar)', () => {
    expect(validateAccount(draft({ name: '  ' }), ctx).name).toBeDefined();
    expect(validateAccount(draft({ name: 'x'.repeat(41) }), ctx).name).toBeDefined();
    expect(validateAccount(draft({ name: ' bca ' }), ctx).name).toMatch(/Sudah ada/);
    const archived = [makeAccount({ id: 'old', name: 'Jago', archived: true })];
    expect(validateAccount(draft({ name: 'Jago' }), { ...ctx, accounts: archived })).toEqual({});
    expect(validateAccount(draft({ id: 'bca', name: 'BCA' }), ctx)).toEqual({});
  });

  it('saldo awal integer ≥ 0 dan tanggal tidak di masa depan', () => {
    expect(validateAccount(draft({ openingBalance: -1 }), ctx).openingBalance).toBeDefined();
    expect(validateAccount(draft({ openingBalance: 1.5 }), ctx).openingBalance).toBeDefined();
    expect(validateAccount(draft({ openingDate: '2026-10-14' }), ctx).openingDate).toBeDefined();
    expect(validateAccount(draft({ openingDate: 'kemarin' }), ctx).openingDate).toBe('Tanggal tidak valid.');
  });

  it('akun lama: tanggal saldo awal dan kelompok dibatasi oleh transaksi yang ada', () => {
    const transactions = [makeTx({ type: 'expense', amount: 1, accountId: 'bca', date: '2026-10-02' })];
    const c = { ...ctx, transactions };
    const edit = draft({ id: 'bca', name: 'BCA' });
    expect(validateAccount({ ...edit, openingDate: '2026-10-05' }, c).openingDate).toMatch(/2 Okt 2026/);
    expect(validateAccount({ ...edit, openingDate: '2026-10-01', group: 'liability' }, c).group).toBeDefined();
  });
});

describe('Validasi kategori', () => {
  it('nama wajib dan unik per jenis di antara yang aktif', () => {
    expect(validateCategory({ ...MAKAN, id: 'x', name: '' }, CATEGORIES).name).toBeDefined();
    expect(validateCategory({ ...MAKAN, id: 'x', name: 'x'.repeat(31) }, CATEGORIES).name).toBeDefined();
    expect(validateCategory({ ...MAKAN, id: 'x', name: 'makan & minum' }, CATEGORIES).name).toMatch(/Sudah ada/);
    expect(validateCategory({ ...GAJI, id: 'x', name: 'makan' }, CATEGORIES)).toEqual({});
  });

  it('minimal 1 kategori aktif per jenis', () => {
    expect(validateArchiveCategory(GAJI, CATEGORIES)).toMatch(/Minimal/);
    expect(validateArchiveCategory(MAKAN, CATEGORIES)).toBeNull();
  });
});

describe('Riwayat', () => {
  const accountsById = new Map(ACCOUNTS.map((a) => [a.id, a]));
  const categoriesById = new Map(CATEGORIES.map((c) => [c.id, c]));
  const txs = [
    makeTx({ id: 'a', type: 'expense', amount: 30_000, accountId: 'bca', categoryId: 'makan', date: '2026-10-12', note: 'Bakso Pak Kumis', createdAt: '1' }),
    makeTx({ id: 'b', type: 'transfer', amount: 100_000, accountId: 'bca', toAccountId: 'gopay', date: '2026-10-12', createdAt: '2' }),
    makeTx({ id: 'c', type: 'income', amount: 5_000, accountId: 'gopay', categoryId: 'makan', isRefund: true, date: '2026-10-12', createdAt: '3' }),
    makeTx({ id: 'd', type: 'income', amount: 9_000_000, accountId: 'bca', categoryId: 'gaji', date: '2026-09-25', createdAt: '4' }),
  ];
  const run = (filter: Parameters<typeof filterTransactions>[1]) =>
    filterTransactions(txs, filter, accountsById, categoriesById).map((t) => t.id);

  it('pencarian mencakup catatan, kategori, dan akun', () => {
    expect(run({ query: 'BAKSO' })).toEqual(['a']);
    expect(run({ query: 'makan' })).toEqual(['a', 'c']);
    expect(run({ query: 'gopay' })).toEqual(['b', 'c']);
  });

  it('filter bisa dikombinasikan; filter akun mencakup akun tujuan transfer', () => {
    expect(run({ month: '2026-09' })).toEqual(['d']);
    expect(run({ type: 'income' })).toEqual(['c', 'd']);
    expect(run({ accountId: 'gopay' })).toEqual(['b', 'c']);
    expect(run({ accountId: 'gopay', type: 'transfer' })).toEqual(['b']);
    expect(run({ categoryId: 'makan', month: '2026-10' })).toEqual(['a', 'c']);
    expect(activeFilterCount({ query: 'x', month: '2026-10', type: 'income' })).toBe(2);
  });

  it('dikelompokkan per tanggal, terbaru dulu, dengan total pengeluaran bersih harian', () => {
    const groups = groupByDate(sortNewestFirst(txs));
    expect(groups.map((g) => [g.date, g.transactions.map((t) => t.id), g.expenseTotal])).toEqual([
      ['2026-10-12', ['c', 'b', 'a'], 25_000],
      ['2026-09-25', ['d'], 0],
    ]);
    expect(monthsWithTransactions(txs)).toEqual(['2026-10', '2026-09']);
  });

  it('kategori diurutkan dari yang paling sering dipakai 30 hari terakhir', () => {
    const transport = makeCategory({ id: 'transport', type: 'expense', sortOrder: 5 });
    const usage = [
      makeTx({ type: 'expense', amount: 1, accountId: 'bca', categoryId: 'transport', date: '2026-10-10' }),
      makeTx({ type: 'expense', amount: 1, accountId: 'bca', categoryId: 'transport', date: '2026-10-11' }),
      makeTx({ type: 'expense', amount: 1, accountId: 'bca', categoryId: 'makan', date: '2026-10-11' }),
      makeTx({ type: 'expense', amount: 1, accountId: 'bca', categoryId: 'biaya', date: '2026-08-01' }),
      makeTx({ type: 'expense', amount: 1, accountId: 'bca', categoryId: 'biaya', date: '2026-08-02' }),
    ];
    const sorted = sortCategoriesByUsage([...CATEGORIES, transport], usage, TODAY).map((c) => c.id);
    expect(sorted.slice(0, 2)).toEqual(['transport', 'makan']);
  });
});

describe('Input nominal', () => {
  it('hanya mengambil digit dan memformat ribuan', () => {
    expect(parseAmountInput('1.250.000')).toBe(1_250_000);
    expect(parseAmountInput('Rp 50rb')).toBe(50);
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('000')).toBe(0);
    expect(parseAmountInput('99999999999999999')).toBe(9_999_999_999_999);
    expect(formatAmountInput(1_250_000)).toBe('1.250.000');
    expect(formatAmountInput(null)).toBe('');
  });

  it('BCA tetap aset', () => {
    expect(BCA.group).toBe('asset');
  });
});
