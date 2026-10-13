import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeBalances } from '../domain/balance';
import { budgetStatus, limitFor } from '../domain/budget';
import { expenseByCategory, monthSummary } from '../domain/report';
import type { TransactionDraft } from '../domain/validation';
import { ACCOUNTS, BCA, CATEGORIES } from '../test/factories';
import { KeuanganDB } from './schema';
import {
  ValidationError,
  deleteTransaction,
  feeIdFor,
  restoreTransactions,
  saveTransaction,
} from './transactions';

const TODAY = '2026-10-13';
let db: KeuanganDB;
let dbCount = 0;

beforeEach(async () => {
  db = new KeuanganDB(`test-${++dbCount}`);
  await db.accounts.bulkPut(ACCOUNTS.map((a) => (a.id === 'bca' ? { ...a, openingBalance: 5_000_000 } : a)));
  await db.categories.bulkPut(CATEGORIES);
});

afterEach(async () => {
  await db.delete();
});

const transfer = (over: Partial<TransactionDraft> = {}): TransactionDraft => ({
  id: 'tr1',
  type: 'transfer',
  date: TODAY,
  amount: 1_000_000,
  accountId: 'bca',
  toAccountId: 'gopay',
  ...over,
});

async function balances() {
  return computeBalances(await db.accounts.toArray(), await db.transactions.toArray());
}

describe('saveTransaction', () => {
  it('QA-08 menyimpan draft yang sama dua kali hanya menghasilkan 1 transaksi', async () => {
    const draft: TransactionDraft = { id: 'e1', type: 'expense', date: TODAY, amount: 50_000, accountId: 'bca', categoryId: 'makan' };
    await Promise.all([
      saveTransaction(db, draft, { today: TODAY }),
      saveTransaction(db, draft, { today: TODAY }),
    ]);
    expect(await db.transactions.count()).toBe(1);
    expect((await balances()).get('bca')).toBe(4_950_000);
  });

  it('QA-03 transfer dengan biaya tersimpan atomik sebagai satu grup', async () => {
    const saved = await saveTransaction(db, transfer(), { today: TODAY, fee: { amount: 2_500, categoryId: 'biaya' } });
    expect(saved.map((t) => t.id)).toEqual(['tr1', feeIdFor('tr1')]);
    expect(saved.every((t) => t.groupId === 'tr1')).toBe(true);
    const b = await balances();
    expect(b.get('bca')).toBe(5_000_000 - 1_002_500);
    expect(b.get('gopay')).toBe(1_000_000);
  });

  it('transaksi tanpa biaya tidak menyimpan properti kosong', async () => {
    const [saved] = await saveTransaction(db, transfer(), { today: TODAY });
    expect(saved).not.toHaveProperty('groupId');
    expect(Object.values(saved)).not.toContain(undefined);
  });

  it('edit transfer: mengubah dan menghapus biaya tambahan', async () => {
    await saveTransaction(db, transfer(), { today: TODAY, fee: { amount: 2_500, categoryId: 'biaya' } });
    await saveTransaction(db, transfer(), { today: TODAY, fee: { amount: 6_500, categoryId: 'biaya' } });
    expect((await db.transactions.get(feeIdFor('tr1')))?.amount).toBe(6_500);
    expect(await db.transactions.count()).toBe(2);

    const [main] = await saveTransaction(db, transfer(), { today: TODAY, fee: null });
    expect(await db.transactions.count()).toBe(1);
    expect(main.groupId).toBeUndefined();
    expect((await balances()).get('bca')).toBe(4_000_000);
  });

  it('QA-07 edit nominal transaksi bulan lalu memperbarui saldo, laporan, dan anggaran bulan lalu', async () => {
    const draft: TransactionDraft = { id: 'old', type: 'expense', date: '2026-09-20', amount: 800_000, accountId: 'bca', categoryId: 'makan' };
    const created = await saveTransaction(db, draft, { today: TODAY, now: new Date('2026-09-20T05:00:00Z') });
    await db.budgetLimits.put({ id: 'bl', categoryId: 'makan', effectiveFrom: '2026-09', amount: 1_000_000 });

    const edited = await saveTransaction(db, { ...draft, amount: 1_200_000 }, { today: TODAY, now: new Date('2026-10-13T05:00:00Z') });
    expect(edited[0].createdAt).toBe(created[0].createdAt);
    expect(edited[0].updatedAt).not.toBe(created[0].updatedAt);

    const txs = await db.transactions.toArray();
    expect((await balances()).get('bca')).toBe(3_800_000);
    expect(monthSummary(txs, '2026-09').expense).toBe(1_200_000);
    const spent = expenseByCategory(txs, '2026-09').get('makan') ?? 0;
    const status = budgetStatus(limitFor(await db.budgetLimits.toArray(), 'makan', '2026-09'), spent);
    expect(status.status).toBe('over');
  });

  it('menolak perubahan jenis transaksi', async () => {
    await saveTransaction(db, transfer(), { today: TODAY });
    const asExpense: TransactionDraft = { id: 'tr1', type: 'expense', date: TODAY, amount: 1, accountId: 'bca', categoryId: 'makan' };
    await expect(saveTransaction(db, asExpense, { today: TODAY })).rejects.toThrow(ValidationError);
  });

  it('validasi gagal tidak menulis apa pun, termasuk biaya', async () => {
    const error = await saveTransaction(db, transfer({ toAccountId: 'bca' }), {
      today: TODAY,
      fee: { amount: 0, categoryId: 'gaji' },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toMatchObject({ toAccountId: expect.any(String), fee: expect.any(String) });
    expect(await db.transactions.count()).toBe(0);
    expect(await db.settings.get('lastDataChangeAt')).toBeUndefined();
  });

  it('biaya tambahan hanya untuk transfer', async () => {
    const draft: TransactionDraft = { id: 'e', type: 'expense', date: TODAY, amount: 1, accountId: 'bca', categoryId: 'makan' };
    await expect(saveTransaction(db, draft, { today: TODAY, fee: { amount: 1, categoryId: 'biaya' } })).rejects.toThrow(
      /hanya untuk transfer/,
    );
  });

  it('mencatat waktu perubahan data terakhir', async () => {
    const now = new Date('2026-10-13T10:00:00Z');
    await saveTransaction(db, transfer(), { today: TODAY, now });
    expect((await db.settings.get('lastDataChangeAt'))?.value).toBe(now.toISOString());
  });
});

describe('deleteTransaction', () => {
  it('QA-25 menghapus transfer beserta biayanya, undo mengembalikan keduanya', async () => {
    await saveTransaction(db, transfer(), { today: TODAY, fee: { amount: 2_500, categoryId: 'biaya' } });
    const before = await db.transactions.orderBy('id').toArray();

    const deleted = await deleteTransaction(db, feeIdFor('tr1'));
    expect(deleted).toHaveLength(2);
    expect(await db.transactions.count()).toBe(0);
    expect((await balances()).get(BCA.id)).toBe(5_000_000);

    await restoreTransactions(db, deleted);
    expect(await db.transactions.orderBy('id').toArray()).toEqual(before);
  });

  it('menghapus transaksi yang tidak ada mengembalikan daftar kosong', async () => {
    expect(await deleteTransaction(db, 'tidak-ada')).toEqual([]);
  });
});
