// Skenario keuangan inti PRD §8.3 dan §12.

import { describe, expect, it } from 'vitest';
import { ACCOUNTS, BCA, BIAYA, GAJI, GOPAY, KARTU, MAKAN, PINJAMAN, makeAccount, makeTx } from '../test/factories';
import { planAdjustment } from './adjustment';
import { computeBalances, computeTotals, transactionEffects } from './balance';
import { expenseByCategory, monthSummary, monthlyTrend } from './report';
import type { Account, Transaction } from './types';

const OCT = '2026-10';

function snapshot(transactions: Transaction[], accounts: Account[] = ACCOUNTS) {
  const balances = computeBalances(accounts, transactions);
  return {
    balance: (a: Account) => balances.get(a.id),
    totals: computeTotals(accounts, balances),
    month: monthSummary(transactions, OCT),
    byCategory: expenseByCategory(transactions, OCT),
  };
}

describe('Skenario keuangan', () => {
  it('QA-01 pengeluaran Rp50.000 dari BCA', () => {
    const bca = { ...BCA, openingBalance: 1_000_000 };
    const s = snapshot([makeTx({ type: 'expense', amount: 50_000, accountId: 'bca', categoryId: 'makan' })], [bca]);
    expect(s.balance(bca)).toBe(950_000);
    expect(s.month.expense).toBe(50_000);
    expect(s.byCategory.get(MAKAN.id)).toBe(50_000);
  });

  it('QA-02 transfer Rp1jt BCA → GoPay tidak mengubah total kas & pengeluaran', () => {
    const accounts = [{ ...BCA, openingBalance: 5_000_000 }, GOPAY];
    const before = snapshot([], accounts);
    const s = snapshot(
      [makeTx({ type: 'transfer', amount: 1_000_000, accountId: 'bca', toAccountId: 'gopay' })],
      accounts,
    );
    expect(s.balance(BCA)).toBe(4_000_000);
    expect(s.balance(GOPAY)).toBe(1_000_000);
    expect(s.totals.totalCash).toBe(before.totals.totalCash);
    expect(s.month.expense).toBe(0);
    expect(s.month.income).toBe(0);
  });

  it('QA-03 transfer Rp1jt dengan biaya Rp2.500', () => {
    const accounts = [{ ...BCA, openingBalance: 5_000_000 }, GOPAY];
    const s = snapshot(
      [
        makeTx({ id: 'tr', type: 'transfer', amount: 1_000_000, accountId: 'bca', toAccountId: 'gopay', groupId: 'tr' }),
        makeTx({ id: 'tr-fee', type: 'expense', amount: 2_500, accountId: 'bca', categoryId: 'biaya', groupId: 'tr' }),
      ],
      accounts,
    );
    expect(s.balance(BCA)).toBe(5_000_000 - 1_002_500);
    expect(s.balance(GOPAY)).toBe(1_000_000);
    expect(s.month.expense).toBe(2_500);
    expect(s.byCategory.get(BIAYA.id)).toBe(2_500);
  });

  it('QA-04 belanja kartu kredit 500rb lalu bayar penuh: pengeluaran tercatat sekali', () => {
    const accounts = [{ ...BCA, openingBalance: 2_000_000 }, KARTU];
    const purchase = makeTx({ type: 'expense', amount: 500_000, accountId: 'kartu', categoryId: 'makan' });
    const afterPurchase = snapshot([purchase], accounts);
    expect(afterPurchase.balance(KARTU)).toBe(500_000);
    expect(afterPurchase.totals.totalDebt).toBe(500_000);
    expect(afterPurchase.month.expense).toBe(500_000);

    const payment = makeTx({ type: 'transfer', amount: 500_000, accountId: 'bca', toAccountId: 'kartu' });
    const s = snapshot([purchase, payment], accounts);
    expect(s.balance(KARTU)).toBe(0);
    expect(s.balance(BCA)).toBe(1_500_000);
    expect(s.month.expense).toBe(500_000);
  });

  it('QA-05 terima pinjaman 2jt: bukan pemasukan, kekayaan bersih tetap', () => {
    const accounts = [{ ...BCA, openingBalance: 1_000_000 }, PINJAMAN];
    const before = snapshot([], accounts);
    const s = snapshot(
      [makeTx({ type: 'transfer', amount: 2_000_000, accountId: 'pinjaman', toAccountId: 'bca' })],
      accounts,
    );
    expect(s.balance(BCA)).toBe(3_000_000);
    expect(s.balance(PINJAMAN)).toBe(2_000_000);
    expect(s.month.income).toBe(0);
    expect(s.totals.netWorth).toBe(before.totals.netWorth);
  });

  it('QA-06 cicilan pokok 200rb + bunga 15rb', () => {
    const accounts = [{ ...BCA, openingBalance: 1_000_000 }, { ...PINJAMAN, openingBalance: 2_000_000 }];
    const s = snapshot(
      [
        makeTx({ id: 'c', type: 'transfer', amount: 200_000, accountId: 'bca', toAccountId: 'pinjaman', groupId: 'c' }),
        makeTx({ id: 'c-fee', type: 'expense', amount: 15_000, accountId: 'bca', categoryId: 'biaya', groupId: 'c' }),
      ],
      accounts,
    );
    expect(s.balance(BCA)).toBe(1_000_000 - 215_000);
    expect(s.balance(PINJAMAN)).toBe(1_800_000);
    expect(s.month.expense).toBe(15_000);
  });

  it('QA-09 saldo awal 3jt bukan pemasukan', () => {
    const bca = { ...BCA, openingBalance: 3_000_000 };
    const s = snapshot([], [bca]);
    expect(s.balance(bca)).toBe(3_000_000);
    expect(s.month.income).toBe(0);
  });

  it('QA-10 refund 20rb kategori Makan mengurangi pengeluaran, bukan pemasukan', () => {
    const accounts = [{ ...BCA, openingBalance: 1_000_000 }];
    const s = snapshot(
      [
        makeTx({ type: 'expense', amount: 100_000, accountId: 'bca', categoryId: 'makan' }),
        makeTx({ type: 'income', amount: 20_000, accountId: 'bca', categoryId: 'makan', isRefund: true }),
      ],
      accounts,
    );
    expect(s.balance(BCA)).toBe(920_000);
    expect(s.byCategory.get(MAKAN.id)).toBe(80_000);
    expect(s.month.expense).toBe(80_000);
    expect(s.month.income).toBe(0);
  });

  it('QA-12 penyesuaian saldo tidak masuk pengeluaran', () => {
    const bca = { ...BCA, openingBalance: 1_200_000 };
    const plan = planAdjustment('bca', 1_200_000, 1_150_000, '2026-10-13');
    expect(plan).toEqual({
      accountId: 'bca',
      date: '2026-10-13',
      amount: 50_000,
      adjustDirection: 'decrease',
      difference: -50_000,
    });
    const s = snapshot([makeTx({ type: 'adjustment', ...plan! })], [bca]);
    expect(s.balance(bca)).toBe(1_150_000);
    expect(s.month.expense).toBe(0);
    expect(s.month.income).toBe(0);
  });

  it('penyesuaian pada akun utang menaikkan jumlah terutang', () => {
    const kartu = { ...KARTU, openingBalance: 300_000 };
    const plan = planAdjustment('kartu', 300_000, 350_000, '2026-10-13')!;
    expect(plan.adjustDirection).toBe('increase');
    const s = snapshot([makeTx({ type: 'adjustment', ...plan })], [kartu]);
    expect(s.balance(kartu)).toBe(350_000);
  });

  it('penyesuaian dengan selisih nol tidak membuat transaksi', () => {
    expect(planAdjustment('bca', 500, 500, '2026-10-13')).toBeNull();
  });
});

describe('Saldo', () => {
  it('pemasukan ke akun utang mengurangi jumlah terutang (misalnya cashback kartu)', () => {
    const kartu = { ...KARTU, openingBalance: 100_000 };
    const effects = transactionEffects(
      makeTx({ type: 'income', amount: 10_000, accountId: 'kartu', categoryId: 'gaji' }),
      new Map([[kartu.id, kartu]]),
    );
    expect(effects.get('kartu')).toBe(-10_000);
  });

  it('mengabaikan transaksi sebelum tanggal saldo awal akun', () => {
    const bca = makeAccount({ id: 'bca', openingBalance: 1_000, openingDate: '2026-10-01' });
    const balances = computeBalances(
      [bca],
      [makeTx({ type: 'expense', amount: 500, accountId: 'bca', date: '2026-09-30' })],
    );
    expect(balances.get('bca')).toBe(1_000);
  });

  it('menghitung saldo per tanggal tertentu', () => {
    const bca = { ...BCA, openingBalance: 1_000 };
    const txs = [
      makeTx({ type: 'income', amount: 500, accountId: 'bca', categoryId: 'gaji', date: '2026-10-01' }),
      makeTx({ type: 'expense', amount: 200, accountId: 'bca', categoryId: 'makan', date: '2026-10-05' }),
    ];
    expect(computeBalances([bca], txs, '2026-10-03').get('bca')).toBe(1_500);
    expect(computeBalances([bca], txs).get('bca')).toBe(1_300);
  });

  it('total kas mengecualikan akun terarsip dan aset di luar Uang tersedia', () => {
    const accounts = [
      { ...BCA, openingBalance: 1_000 },
      makeAccount({ id: 'emas', kind: 'other_asset', openingBalance: 5_000, includeInAvailable: false }),
      makeAccount({ id: 'lama', openingBalance: 700, archived: true }),
      { ...KARTU, openingBalance: 400 },
    ];
    const totals = computeTotals(accounts, computeBalances(accounts, []));
    expect(totals).toEqual({ totalCash: 1_000, totalDebt: 400, netWorth: 1_000 + 5_000 + 700 - 400 });
  });

  it('melempar error jika transaksi mengacu ke akun yang tidak ada', () => {
    expect(() => computeBalances([BCA], [makeTx({ type: 'expense', amount: 1, accountId: 'hilang' })])).toThrow();
  });
});

describe('Laporan', () => {
  const txs = [
    makeTx({ type: 'income', amount: 10_000_000, accountId: 'bca', categoryId: 'gaji', date: '2026-10-01' }),
    makeTx({ type: 'expense', amount: 300_000, accountId: 'bca', categoryId: 'makan', date: '2026-10-02' }),
    makeTx({ type: 'expense', amount: 200_000, accountId: 'bca', categoryId: 'makan', date: '2026-09-30' }),
    makeTx({ type: 'transfer', amount: 1_000_000, accountId: 'bca', toAccountId: 'gopay', date: '2026-10-03' }),
    makeTx({ type: 'adjustment', amount: 5_000, accountId: 'bca', adjustDirection: 'decrease', date: '2026-10-04' }),
  ];

  it('ringkasan bulan hanya menghitung transaksi bulan itu, tanpa transfer & penyesuaian', () => {
    expect(monthSummary(txs, '2026-10')).toEqual({ income: 10_000_000, expense: 300_000, net: 9_700_000 });
    expect(monthSummary(txs, '2026-09')).toEqual({ income: 0, expense: 200_000, net: -200_000 });
  });

  it('total per kategori sama dengan total pengeluaran (selisih Rp0)', () => {
    const byCategory = expenseByCategory(txs, '2026-10');
    const sum = [...byCategory.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(monthSummary(txs, '2026-10').expense);
    expect(byCategory.has(GAJI.id)).toBe(false);
  });

  it('pengeluaran kategori bisa negatif jika refund melebihi belanja bulan itu', () => {
    const refundOnly = [makeTx({ type: 'income', amount: 50_000, accountId: 'bca', categoryId: 'makan', isRefund: true })];
    expect(expenseByCategory(refundOnly, OCT).get('makan')).toBe(-50_000);
  });

  it('tren 6 bulan urut lama → baru, melewati batas tahun', () => {
    const trend = monthlyTrend(txs, '2027-01');
    expect(trend.map((t) => t.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
    expect(trend[2]).toEqual({ month: '2026-10', income: 10_000_000, expense: 300_000, net: 9_700_000 });
  });
});
