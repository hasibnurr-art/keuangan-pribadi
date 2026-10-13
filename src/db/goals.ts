// Operasi tulis target tabungan (PRD §9.14).

import { computeBalances } from '../domain/balance';
import type { AccountDraft } from '../domain/entityRules';
import { validateGoal, type GoalDraft, type GoalErrors } from '../domain/goals';
import type { Goal, ID, LocalDate, Rupiah } from '../domain/types';
import { toYearMonth } from '../lib/date';
import { saveAccount } from './accounts';
import { saveBill } from './bills';
import type { KeuanganDB } from './schema';
import { touchData } from './transactions';

export class GoalValidationError extends Error {
  readonly errors: GoalErrors;
  constructor(errors: GoalErrors) {
    super(Object.values(errors).join(' '));
    this.name = 'GoalValidationError';
    this.errors = errors;
  }
}

export interface DepositPlan {
  amount: Rupiah;
  dueDay: number;
  fromAccountId: ID;
}

export interface CreateGoalInput {
  goal: GoalDraft;
  /** Jika diisi, akun tabungan baru dibuat dan dipakai sebagai akun target. */
  newAccount?: AccountDraft;
  /** Jika diisi, dibuat tagihan transfer bulanan "Nabung …" ke akun target. */
  deposit?: DepositPlan;
  today: LocalDate;
  now?: Date;
}

/** Buat target secara atomik: akun baru (opsional) + target + tagihan setoran (opsional). */
export async function createGoal(db: KeuanganDB, input: CreateGoalInput): Promise<Goal> {
  const { goal: draft, newAccount, deposit, today, now = new Date() } = input;
  return db.transaction('rw', [db.accounts, db.categories, db.transactions, db.bills, db.goals, db.settings], async () => {
    if (newAccount) {
      await saveAccount(db, { ...newAccount, group: 'asset', includeInAvailable: false }, { today, now });
    }
    const [accounts, goals] = await Promise.all([db.accounts.toArray(), db.goals.toArray()]);
    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    const errors = validateGoal(draft, { accountsById, goals, today, isNew: true });
    if (Object.keys(errors).length > 0) throw new GoalValidationError(errors);

    // Uang tabungan tidak boleh ikut "Uang tersedia".
    const account = accountsById.get(draft.accountId)!;
    if (account.includeInAvailable) {
      await db.accounts.put({ ...account, includeInAvailable: false, updatedAt: now.toISOString() });
    }

    const related = await db.transactions.where('accountId').equals(account.id).or('toAccountId').equals(account.id).toArray();
    const others = accounts.filter((a) => related.some((t) => t.accountId === a.id || t.toAccountId === a.id));
    const startAmount = Math.max(0, computeBalances([account, ...others.filter((a) => a.id !== account.id)], related).get(account.id) ?? 0);

    const timestamp = now.toISOString();
    const goal: Goal = {
      ...draft,
      name: draft.name.trim(),
      startDate: today,
      startAmount,
      archived: false,
      sortOrder: goals.reduce((max, g) => Math.max(max, g.sortOrder + 1), 0),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.goals.put(goal);

    if (deposit) {
      await saveBill(
        db,
        {
          id: crypto.randomUUID(),
          name: `Nabung ${goal.name}`.slice(0, 40),
          kind: 'transfer',
          amount: deposit.amount,
          isVariable: false,
          dueDay: deposit.dueDay,
          accountId: deposit.fromAccountId,
          toAccountId: goal.accountId,
          startMonth: toYearMonth(today),
          endMonth: goal.targetMonth,
        },
        now,
      );
    }
    await touchData(db, now);
    return goal;
  });
}

/** Ubah nama, ikon, jumlah, atau bulan target. Akun target tidak bisa diganti. */
export async function updateGoal(db: KeuanganDB, draft: GoalDraft, today: LocalDate, now: Date = new Date()): Promise<Goal> {
  return db.transaction('rw', [db.accounts, db.goals, db.settings], async () => {
    const existing = await db.goals.get(draft.id);
    if (!existing) throw new Error('Target tidak ditemukan.');
    const [accounts, goals] = await Promise.all([db.accounts.toArray(), db.goals.toArray()]);
    const errors = validateGoal(
      { ...draft, accountId: existing.accountId },
      { accountsById: new Map(accounts.map((a) => [a.id, a])), goals, today, isNew: false },
    );
    if (Object.keys(errors).length > 0) throw new GoalValidationError(errors);
    const goal: Goal = { ...existing, ...draft, accountId: existing.accountId, name: draft.name.trim(), updatedAt: now.toISOString() };
    await db.goals.put(goal);
    await touchData(db, now);
    return goal;
  });
}

export async function setGoalArchived(db: KeuanganDB, goalId: ID, archived: boolean, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', [db.goals, db.settings], async () => {
    const goal = await db.goals.get(goalId);
    if (!goal) throw new Error('Target tidak ditemukan.');
    if (!archived) {
      const clash = (await db.goals.toArray()).find((g) => g.id !== goalId && !g.archived && g.accountId === goal.accountId);
      if (clash) throw new Error(`Akun target sudah dipakai target aktif "${clash.name}".`);
    }
    await db.goals.put({ ...goal, archived, updatedAt: now.toISOString() });
    await touchData(db, now);
  });
}

/** Menghapus target saja. Akun tabungan, transaksi, dan tagihan setoran tetap ada. */
export async function deleteGoal(db: KeuanganDB, goalId: ID, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', [db.goals, db.settings], async () => {
    await db.goals.delete(goalId);
    await touchData(db, now);
  });
}
