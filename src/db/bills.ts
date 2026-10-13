// Operasi tulis tagihan rutin (PRD §9.9).

import { billHasPayments, validateBill, type BillDraft, type BillErrors } from '../domain/billRules';
import type { Bill, ID, YearMonth } from '../domain/types';
import type { KeuanganDB } from './schema';
import { touchData } from './transactions';

export class BillValidationError extends Error {
  readonly errors: BillErrors;
  constructor(errors: BillErrors) {
    super(Object.values(errors).join(' '));
    this.name = 'BillValidationError';
    this.errors = errors;
  }
}

export async function saveBill(db: KeuanganDB, draft: BillDraft, now: Date = new Date()): Promise<Bill> {
  return db.transaction('rw', [db.accounts, db.categories, db.bills, db.settings], async () => {
    const [accounts, categories, existing] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.bills.get(draft.id),
    ]);
    const errors = validateBill(draft, {
      accountsById: new Map(accounts.map((a) => [a.id, a])),
      categoriesById: new Map(categories.map((c) => [c.id, c])),
      isNew: !existing,
    });
    if (Object.keys(errors).length > 0) throw new BillValidationError(errors);

    const bill: Bill = {
      id: draft.id,
      name: draft.name.trim(),
      kind: draft.kind,
      amount: draft.amount,
      isVariable: draft.isVariable,
      dueDay: draft.dueDay,
      accountId: draft.accountId,
      ...(draft.kind === 'transfer' ? { toAccountId: draft.toAccountId } : { categoryId: draft.categoryId }),
      startMonth: draft.startMonth,
      ...(draft.endMonth ? { endMonth: draft.endMonth } : {}),
      active: draft.active ?? existing?.active ?? true,
      ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
    };
    await db.bills.put(bill);
    await touchData(db, now);
    return bill;
  });
}

/** Tagihan yang sudah punya pembayaran tidak bisa dihapus (riwayat), hanya dinonaktifkan. */
export async function deleteBill(db: KeuanganDB, billId: ID, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', [db.bills, db.billSkips, db.transactions, db.settings], async () => {
    const payments = await db.transactions.toArray();
    if (billHasPayments(billId, payments)) {
      throw new Error('Tagihan ini sudah punya riwayat pembayaran. Nonaktifkan saja agar riwayatnya tetap ada.');
    }
    await db.billSkips.where('[billId+period]').between([billId, ''], [billId, '￿']).delete();
    await db.bills.delete(billId);
    await touchData(db, now);
  });
}

export async function setBillSkipped(
  db: KeuanganDB,
  { billId, period, skipped, now = new Date() }: { billId: ID; period: YearMonth; skipped: boolean; now?: Date },
): Promise<void> {
  await db.transaction('rw', [db.bills, db.billSkips, db.settings], async () => {
    if (!(await db.bills.get(billId))) throw new Error('Tagihan tidak ditemukan.');
    if (skipped) await db.billSkips.put({ billId, period });
    else await db.billSkips.delete([billId, period]);
    await touchData(db, now);
  });
}
