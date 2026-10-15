import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeBalances } from '../domain/balance';
import { DEFAULT_CATEGORIES } from '../domain/defaults';
import type { AccountDraft } from '../domain/entityRules';
import { adjustBalance, deleteAccount, saveAccount, setAccountArchived } from './accounts';
import { moveCategory, saveCategory, setCategoryArchived } from './categories';
import { completeOnboarding } from './onboarding';
import { KeuanganDB } from './schema';
import { getAllSettings, getSetting } from './settings';
import { getTransactionGroup, saveTransaction, undoSave } from './transactions';

const TODAY = '2026-10-13';
let db: KeuanganDB;
let n = 0;

const bca: AccountDraft = {
  id: 'bca',
  name: 'BCA',
  group: 'asset',
  kind: 'bank',
  openingBalance: 1_200_000,
  openingDate: '2026-10-01',
  includeInAvailable: true,
};
const kartu: AccountDraft = {
  id: 'kartu',
  name: 'Kartu BCA',
  group: 'liability',
  kind: 'credit_card',
  openingBalance: 300_000,
  openingDate: '2026-10-01',
  includeInAvailable: true,
};

beforeEach(async () => {
  db = new KeuanganDB(`m2-${++n}`);
  await completeOnboarding(db, bca, { today: TODAY });
});
afterEach(() => db.delete());

const balances = async () => computeBalances(await db.accounts.toArray(), await db.transactions.toArray());

describe('Onboarding', () => {
  it('membuat akun pertama, kategori default, dan pengaturan', async () => {
    expect(await db.accounts.count()).toBe(1);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
    const settings = await getAllSettings(db);
    expect(settings).toMatchObject({ onboardingDone: true, feeCategoryId: 'cat-biaya', lastUsedAccountId: 'bca', userName: '' });
  });

  it('diulang tidak membuat akun atau kategori ganda', async () => {
    await completeOnboarding(db, bca, { today: TODAY });
    expect(await db.accounts.count()).toBe(1);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it('akun pertama tidak valid membatalkan seluruh onboarding', async () => {
    const fresh = new KeuanganDB(`m2-fresh-${n}`);
    await expect(completeOnboarding(fresh, { ...bca, name: '' }, { today: TODAY })).rejects.toThrow();
    expect(await fresh.categories.count()).toBe(0);
    expect(await getSetting(fresh, 'onboardingDone')).toBe(false);
    await fresh.delete();
  });
});

describe('Akun', () => {
  it('urutan akun bertambah; includeInAvailable dipaksa false untuk utang', async () => {
    const saved = await saveAccount(db, kartu, { today: TODAY });
    expect(saved.sortOrder).toBe(1);
    expect(saved.includeInAvailable).toBe(false);
  });

  it('menolak nama ganda', async () => {
    await expect(saveAccount(db, { ...kartu, name: 'bca' }, { today: TODAY })).rejects.toThrow(/Sudah ada/);
  });

  it('arsip ditolak jika saldo ≠ 0, berhasil setelah disesuaikan ke 0', async () => {
    await expect(setAccountArchived(db, 'bca', true)).rejects.toThrow(/Sesuaikan saldo/);
    await adjustBalance(db, { id: 'adj', accountId: 'bca', actualBalance: 0, today: TODAY });
    await setAccountArchived(db, 'bca', true);
    expect((await db.accounts.get('bca'))?.archived).toBe(true);
    await setAccountArchived(db, 'bca', false);
    expect((await db.accounts.get('bca'))?.archived).toBe(false);
  });

  it('hapus hanya jika belum ada transaksi dan tidak dipakai tagihan', async () => {
    await saveAccount(db, kartu, { today: TODAY });
    await db.bills.put({ id: 'b', name: 'Kartu', kind: 'transfer', amount: 1, isVariable: true, dueDay: 5, accountId: 'bca', toAccountId: 'kartu', startMonth: '2026-10', active: true });
    await expect(deleteAccount(db, 'kartu')).rejects.toThrow(/tagihan/);
    await db.bills.clear();

    await saveTransaction(db, { id: 't', type: 'expense', date: TODAY, amount: 1, accountId: 'kartu', categoryId: 'cat-makan' }, { today: TODAY });
    await expect(deleteAccount(db, 'kartu')).rejects.toThrow(/Arsipkan/);
    await db.transactions.clear();
    await deleteAccount(db, 'kartu');
    expect(await db.accounts.get('kartu')).toBeUndefined();
  });
});

describe('Sesuaikan saldo', () => {
  it('QA-12 lewat database: penyesuaian −50rb menyamakan saldo', async () => {
    const tx = await adjustBalance(db, { id: 'adj', accountId: 'bca', actualBalance: 1_150_000, today: TODAY });
    expect(tx).toMatchObject({ type: 'adjustment', amount: 50_000, adjustDirection: 'decrease', date: TODAY });
    expect((await balances()).get('bca')).toBe(1_150_000);
  });

  it('memperhitungkan transfer masuk dari akun lain', async () => {
    await saveAccount(db, { ...bca, id: 'gopay', name: 'GoPay', kind: 'ewallet', openingBalance: 0 }, { today: TODAY });
    await saveTransaction(db, { id: 'tr', type: 'transfer', date: TODAY, amount: 200_000, accountId: 'bca', toAccountId: 'gopay' }, { today: TODAY });
    const tx = await adjustBalance(db, { id: 'adj', accountId: 'gopay', actualBalance: 250_000, today: TODAY });
    expect(tx).toMatchObject({ amount: 50_000, adjustDirection: 'increase' });
    expect((await balances()).get('gopay')).toBe(250_000);
  });

  it('akun utang: menaikkan jumlah terutang', async () => {
    await saveAccount(db, kartu, { today: TODAY });
    await adjustBalance(db, { id: 'adj', accountId: 'kartu', actualBalance: 450_000, today: TODAY });
    expect((await balances()).get('kartu')).toBe(450_000);
  });

  it('tanpa selisih tidak membuat transaksi; nilai negatif ditolak', async () => {
    expect(await adjustBalance(db, { id: 'adj', accountId: 'bca', actualBalance: 1_200_000, today: TODAY })).toBeNull();
    expect(await db.transactions.count()).toBe(0);
    await expect(adjustBalance(db, { id: 'adj', accountId: 'bca', actualBalance: -1, today: TODAY })).rejects.toThrow();
  });
});

describe('Kategori', () => {
  it('tambah kategori kustom di akhir urutan', async () => {
    const saved = await saveCategory(db, { id: 'kopi', name: 'Kopi', type: 'expense', icon: '☕', color: 'amber' });
    expect(saved.sortOrder).toBe(14);
    await expect(saveCategory(db, { id: 'kopi2', name: 'kopi', type: 'expense', icon: '☕', color: 'amber' })).rejects.toThrow();
    await expect(saveCategory(db, { ...saved, type: 'income' })).rejects.toThrow(/tidak bisa diubah/);
  });

  it('arsip dibatasi minimal satu kategori aktif per jenis', async () => {
    const income = (await db.categories.where('type').equals('income').toArray()).map((c) => c.id);
    for (const id of income.slice(1)) await setCategoryArchived(db, id, true);
    await expect(setCategoryArchived(db, income[0], true)).rejects.toThrow(/Minimal/);
  });

  it('memindahkan urutan kategori', async () => {
    await moveCategory(db, 'cat-belanja-harian', -1);
    const sorted = (await db.categories.where('type').equals('expense').sortBy('sortOrder')).map((c) => c.id);
    expect(sorted.slice(0, 2)).toEqual(['cat-belanja-harian', 'cat-makan']);
    await moveCategory(db, 'cat-belanja-harian', -1);
    expect((await db.categories.get('cat-belanja-harian'))?.sortOrder).toBe(0);
  });
});

describe('Undo simpan', () => {
  it('undo edit transfer mengembalikan biaya lama', async () => {
    await saveAccount(db, { ...bca, id: 'gopay', name: 'GoPay', kind: 'ewallet', openingBalance: 0 }, { today: TODAY });
    const draft = { id: 'tr', type: 'transfer' as const, date: TODAY, amount: 100_000, accountId: 'bca', toAccountId: 'gopay' };
    await saveTransaction(db, draft, { today: TODAY, fee: { amount: 2_500, categoryId: 'cat-biaya' } });
    const previous = await getTransactionGroup(db, 'tr');

    const saved = await saveTransaction(db, { ...draft, amount: 300_000 }, { today: TODAY });
    expect(await db.transactions.count()).toBe(1);

    await undoSave(db, saved, previous);
    expect(await db.transactions.orderBy('id').toArray()).toEqual(previous.sort((a, b) => a.id.localeCompare(b.id)));
  });

  it('undo transaksi baru menghapusnya', async () => {
    const saved = await saveTransaction(db, { id: 'e', type: 'expense', date: TODAY, amount: 1, accountId: 'bca', categoryId: 'cat-makan' }, { today: TODAY });
    await undoSave(db, saved, []);
    expect(await db.transactions.count()).toBe(0);
  });
});
