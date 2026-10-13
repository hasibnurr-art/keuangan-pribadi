// Anggaran (PRD §8.5, §9.8). Mengubah batas membuat record baru berlaku mulai
// bulan berjalan sehingga bulan-bulan sebelumnya tetap memakai batas lamanya.

import type { BudgetLimit, ID, Rupiah, YearMonth } from '../domain/types';
import { MAX_AMOUNT } from '../domain/types';
import type { KeuanganDB } from './schema';
import { touchData } from './transactions';

export async function setBudgetLimit(
  db: KeuanganDB,
  { categoryId, month, amount, now = new Date() }: { categoryId: ID; month: YearMonth; amount: Rupiah; now?: Date },
): Promise<BudgetLimit> {
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_AMOUNT) {
    throw new Error('Batas anggaran harus bilangan bulat Rp0 atau lebih.');
  }
  return db.transaction('rw', [db.categories, db.budgetLimits, db.settings], async () => {
    const category = await db.categories.get(categoryId);
    if (!category || category.type !== 'expense') throw new Error('Anggaran hanya untuk kategori pengeluaran.');
    const sameMonth = (await db.budgetLimits.where('categoryId').equals(categoryId).toArray()).find(
      (l) => l.effectiveFrom === month,
    );
    const limit: BudgetLimit = { id: sameMonth?.id ?? crypto.randomUUID(), categoryId, effectiveFrom: month, amount };
    await db.budgetLimits.put(limit);
    await touchData(db, now);
    return limit;
  });
}
