import { describe, expect, it } from 'vitest';
import { ACCOUNTS, makeBill, makeTx } from '../test/factories';
import { availableMoney, billDueDate, billOccurrences, dueSoon } from './bills';
import type { BillSkip } from './types';

describe('Uang tersedia', () => {
  it('QA-13 kas 5jt − tagihan bulan ini 1,5jt − tagihan terlambat 300rb; tagihan via kartu kredit diabaikan', () => {
    const bills = [
      makeBill({ id: 'listrik', amount: 1_500_000, dueDay: 20, accountId: 'bca' }),
      makeBill({ id: 'cicilan', amount: 300_000, dueDay: 25, accountId: 'bca', startMonth: '2026-09', endMonth: '2026-09' }),
      makeBill({ id: 'netflix', amount: 100_000, dueDay: 15, accountId: 'kartu' }),
    ];
    const result = availableMoney(ACCOUNTS, 5_000_000, bills, [], [], '2026-10-13');
    expect(result.available).toBe(3_200_000);
    expect(result.pendingTotal).toBe(1_800_000);
    expect(result.pendingBills.map((o) => `${o.bill.id}:${o.period}:${o.status}`)).toEqual([
      'cicilan:2026-09:overdue',
      'listrik:2026-10:upcoming',
    ]);
  });

  it('tagihan yang sudah dibayar, dilewati, atau jatuh tempo bulan depan tidak dikurangkan', () => {
    const bills = [
      makeBill({ id: 'listrik', amount: 400_000, dueDay: 20, accountId: 'bca' }),
      makeBill({ id: 'air', amount: 100_000, dueDay: 10, accountId: 'bca' }),
      makeBill({ id: 'internet', amount: 350_000, dueDay: 5, accountId: 'bca', startMonth: '2026-11' }),
    ];
    const paid = makeTx({ type: 'expense', amount: 410_000, accountId: 'bca', categoryId: 'makan', billId: 'listrik', billPeriod: '2026-10' });
    const skips: BillSkip[] = [{ billId: 'air', period: '2026-10' }];
    const result = availableMoney(ACCOUNTS, 1_000_000, bills, [paid], skips, '2026-10-13');
    expect(result.available).toBe(1_000_000);
  });
});

describe('Status tagihan', () => {
  const listrik = makeBill({ id: 'listrik', amount: 400_000, dueDay: 20, accountId: 'bca' });
  const status = (txs = [] as ReturnType<typeof makeTx>[], skips: BillSkip[] = [], today = '2026-10-25') =>
    billOccurrences([listrik], txs, skips, today, '2026-10')[0]?.status;

  it('QA-14 bayar → hapus pembayaran → lewati', () => {
    expect(status([], [], '2026-10-13')).toBe('upcoming');
    expect(status()).toBe('overdue');
    const payment = makeTx({ type: 'expense', amount: 400_000, accountId: 'bca', categoryId: 'makan', billId: 'listrik', billPeriod: '2026-10' });
    expect(status([payment])).toBe('paid');
    expect(status([])).toBe('overdue');
    expect(status([], [{ billId: 'listrik', period: '2026-10' }])).toBe('skipped');
  });

  it('QA-15 tanggal jatuh tempo 31 dipotong ke akhir Februari', () => {
    const bill = makeBill({ id: 'b', amount: 1, dueDay: 31, accountId: 'bca' });
    expect(billDueDate(bill, '2027-02')).toBe('2027-02-28');
    expect(billDueDate(bill, '2028-02')).toBe('2028-02-29');
    expect(billDueDate(bill, '2026-11')).toBe('2026-11-30');
  });

  it('tidak ada kejadian sebelum startMonth atau setelah endMonth', () => {
    const bill = makeBill({ id: 'cicil', amount: 1, dueDay: 5, accountId: 'bca', startMonth: '2026-08', endMonth: '2026-10' });
    const periods = billOccurrences([bill], [], [], '2026-12-01', '2026-12').map((o) => o.period);
    expect(periods).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('tagihan nonaktif hanya menyisakan riwayat yang sudah dibayar', () => {
    const bill = makeBill({ id: 'gym', amount: 1, dueDay: 5, accountId: 'bca', startMonth: '2026-09', active: false });
    const payment = makeTx({ type: 'expense', amount: 1, accountId: 'bca', billId: 'gym', billPeriod: '2026-09' });
    const occ = billOccurrences([bill], [payment], [], '2026-10-13', '2026-10');
    expect(occ.map((o) => `${o.period}:${o.status}`)).toEqual(['2026-09:paid']);
  });

  it('dueSoon: terlambat + jatuh tempo ≤ 14 hari, termasuk lintas bulan', () => {
    const bills = [
      makeBill({ id: 'a', amount: 1, dueDay: 2, accountId: 'bca' }),
      makeBill({ id: 'b', amount: 1, dueDay: 30, accountId: 'bca' }),
      makeBill({ id: 'c', amount: 1, dueDay: 5, accountId: 'kartu' }),
      makeBill({ id: 'd', amount: 1, dueDay: 15, accountId: 'bca' }),
    ];
    const ids = dueSoon(bills, [], [], '2026-10-25').map((o) => `${o.bill.id}:${o.period}`);
    // a/c/d terlambat bulan ini; b jatuh tempo 30 Okt; a & c bulan depan masuk horizon 8 Nov.
    expect(ids).toEqual(['a:2026-10', 'c:2026-10', 'd:2026-10', 'b:2026-10', 'a:2026-11', 'c:2026-11']);
  });
});
