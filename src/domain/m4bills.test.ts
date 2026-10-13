import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveAccount, setAccountArchived } from '../db/accounts';
import { BillValidationError, deleteBill, saveBill, setBillSkipped } from '../db/bills';
import { completeOnboarding } from '../db/onboarding';
import { KeuanganDB } from '../db/schema';
import { ValidationError, saveTransaction } from '../db/transactions';
import { ACCOUNTS, CATEGORIES, makeAccount, makeBill, makeTx } from '../test/factories';
import { billHasPayments, billsOverview, daysLate, validateBill, type BillDraft } from './billRules';

const ctx = (isNew = true) => ({
  accountsById: new Map(ACCOUNTS.map((a) => [a.id, a])),
  categoriesById: new Map(CATEGORIES.map((c) => [c.id, c])),
  isNew,
});
const listrik = (over: Partial<BillDraft> = {}): BillDraft => ({
  id: 'listrik',
  name: 'Listrik',
  kind: 'expense',
  amount: 400_000,
  isVariable: true,
  dueDay: 20,
  accountId: 'bca',
  categoryId: 'makan',
  startMonth: '2026-10',
  ...over,
});

describe('Validasi tagihan', () => {
  it('tagihan valid', () => {
    expect(validateBill(listrik(), ctx())).toEqual({});
    expect(validateBill(listrik({ kind: 'transfer', categoryId: undefined, toAccountId: 'kartu' }), ctx())).toEqual({});
  });

  it('field wajib dan batas nilai', () => {
    const errors = validateBill(
      listrik({ name: ' ', amount: 0, dueDay: 32, accountId: 'x', categoryId: 'gaji', startMonth: '2026-13', note: 'a'.repeat(201) }),
      ctx(),
    );
    expect(Object.keys(errors).sort()).toEqual(['accountId', 'amount', 'categoryId', 'dueDay', 'name', 'note', 'startMonth']);
    expect(errors.amount).toMatch(/perkiraan/);
  });

  it('transfer: akun tujuan wajib dan berbeda dari pembayar', () => {
    expect(validateBill(listrik({ kind: 'transfer', toAccountId: undefined }), ctx()).toAccountId).toBe('Pilih akun tujuan.');
    expect(validateBill(listrik({ kind: 'transfer', toAccountId: 'bca' }), ctx()).toAccountId).toMatch(/berbeda/);
  });

  it('bulan berakhir tidak boleh sebelum bulan mulai', () => {
    expect(validateBill(listrik({ endMonth: '2026-09' }), ctx()).endMonth).toMatch(/sebelum/);
    expect(validateBill(listrik({ endMonth: '2026-10' }), ctx())).toEqual({});
  });

  it('akun terarsip ditolak untuk tagihan baru, boleh saat mengubah', () => {
    const accountsById = new Map([['lama', makeAccount({ id: 'lama', archived: true })]]);
    const draft = listrik({ accountId: 'lama' });
    expect(validateBill(draft, { ...ctx(), accountsById }).accountId).toMatch(/diarsipkan/);
    expect(validateBill(draft, { ...ctx(false), accountsById }).accountId).toBeUndefined();
  });
});

describe('Ringkasan tagihan', () => {
  it('mengelompokkan Terlambat / Bulan ini / Bulan depan', () => {
    const bills = [
      makeBill({ id: 'internet', amount: 350_000, dueDay: 5, accountId: 'bca', startMonth: '2026-09' }),
      makeBill({ id: 'listrik', amount: 400_000, dueDay: 20, accountId: 'bca' }),
      makeBill({ id: 'air', amount: 100_000, dueDay: 2, accountId: 'bca' }),
    ];
    const txs = [makeTx({ type: 'expense', amount: 350_000, accountId: 'bca', billId: 'internet', billPeriod: '2026-09' })];
    const skips = [{ billId: 'air', period: '2026-10' }];
    const o = billsOverview(bills, txs, skips, '2026-10-13');
    const ids = (list: typeof o.overdue) => list.map((x) => `${x.bill.id}:${x.period}:${x.status}`);
    expect(ids(o.overdue)).toEqual(['internet:2026-10:overdue']);
    expect(ids(o.thisMonth)).toEqual(['air:2026-10:skipped', 'listrik:2026-10:upcoming']);
    expect(ids(o.nextMonth)).toEqual(['air:2026-11:upcoming', 'internet:2026-11:upcoming', 'listrik:2026-11:upcoming']);
    expect(daysLate(o.overdue[0], '2026-10-13')).toBe(8);
    expect(billHasPayments('internet', txs)).toBe(true);
    expect(billHasPayments('listrik', txs)).toBe(false);
  });
});

describe('Repositori tagihan', () => {
  let db: KeuanganDB;
  let n = 0;
  const TODAY = '2026-10-13';
  const bca = { id: 'bca', name: 'BCA', group: 'asset' as const, kind: 'bank' as const, openingBalance: 5_000_000, openingDate: '2026-10-01', includeInAvailable: true };

  beforeEach(async () => {
    db = new KeuanganDB(`m4-${++n}`);
    await completeOnboarding(db, bca, { today: TODAY });
  });
  afterEach(() => db.delete());

  const draft = (over: Partial<BillDraft> = {}) => listrik({ categoryId: 'cat-tagihan', ...over });

  it('menyimpan hanya field yang relevan dengan jenisnya', async () => {
    const saved = await saveBill(db, draft({ toAccountId: 'bca', note: '  ' }));
    expect(saved).not.toHaveProperty('toAccountId');
    expect(saved).not.toHaveProperty('note');
    expect(saved.active).toBe(true);
    await saveBill(db, { ...saved, active: false });
    expect((await db.bills.get('listrik'))?.active).toBe(false);
  });

  it('menolak tagihan tidak valid tanpa menulis apa pun', async () => {
    await expect(saveBill(db, draft({ amount: 0 }))).rejects.toBeInstanceOf(BillValidationError);
    expect(await db.bills.count()).toBe(0);
  });

  it('pembayaran harus merujuk tagihan yang ada', async () => {
    const pay = { id: 'p', type: 'expense' as const, date: TODAY, amount: 1, accountId: 'bca', categoryId: 'cat-tagihan', billId: 'tidak-ada', billPeriod: '2026-10' };
    await expect(saveTransaction(db, pay, { today: TODAY })).rejects.toBeInstanceOf(ValidationError);
    await saveBill(db, draft());
    await saveTransaction(db, { ...pay, billId: 'listrik' }, { today: TODAY });
    await expect(saveTransaction(db, { ...pay, id: 'p2', billId: 'listrik', billPeriod: '10-2026' }, { today: TODAY })).rejects.toThrow();
  });

  it('hapus tagihan: ditolak jika sudah ada pembayaran; lewati ikut terhapus jika belum', async () => {
    await saveBill(db, draft());
    await setBillSkipped(db, { billId: 'listrik', period: '2026-10', skipped: true });
    expect(await db.billSkips.count()).toBe(1);
    await deleteBill(db, 'listrik');
    expect(await db.bills.count()).toBe(0);
    expect(await db.billSkips.count()).toBe(0);

    await saveBill(db, draft());
    await saveTransaction(db, { id: 'p', type: 'expense', date: TODAY, amount: 1, accountId: 'bca', categoryId: 'cat-tagihan', billId: 'listrik', billPeriod: '2026-10' }, { today: TODAY });
    await expect(deleteBill(db, 'listrik')).rejects.toThrow(/Nonaktifkan/);
  });

  it('lewati bisa dibatalkan', async () => {
    await saveBill(db, draft());
    await setBillSkipped(db, { billId: 'listrik', period: '2026-10', skipped: true });
    await setBillSkipped(db, { billId: 'listrik', period: '2026-10', skipped: false });
    expect(await db.billSkips.count()).toBe(0);
    await expect(setBillSkipped(db, { billId: 'x', period: '2026-10', skipped: true })).rejects.toThrow();
  });

  it('akun yang dipakai tagihan aktif tidak bisa diarsipkan', async () => {
    await saveAccount(db, { ...bca, id: 'kartu', name: 'Kartu', group: 'liability', kind: 'credit_card', openingBalance: 0 }, { today: TODAY });
    await saveBill(db, draft({ kind: 'transfer', categoryId: undefined, toAccountId: 'kartu', name: 'Bayar kartu' }));
    await expect(setAccountArchived(db, 'kartu', true)).rejects.toThrow(/Bayar kartu/);
    await saveBill(db, { ...(await db.bills.get('listrik'))!, active: false });
    await setAccountArchived(db, 'kartu', true);
    expect((await db.accounts.get('kartu'))?.archived).toBe(true);
  });
});
