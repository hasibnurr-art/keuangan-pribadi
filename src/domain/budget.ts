// Anggaran bulanan per kategori, tanpa rollover (PRD §8.5).

import type { BudgetLimit, ID, Rupiah, YearMonth } from './types';

export const WARNING_RATIO = 0.8;

export type BudgetStatusKind = 'none' | 'ok' | 'warning' | 'over';

export interface BudgetStatus {
  limit: Rupiah | null;
  spent: Rupiah;
  /** limit − spent; negatif berarti terlampaui. null jika tidak ada anggaran. */
  remaining: Rupiah | null;
  /** spent ÷ limit; null jika tidak ada anggaran. */
  ratio: number | null;
  status: BudgetStatusKind;
}

/** Batas yang berlaku untuk kategori pada bulan `ym`, atau null jika tidak ada/dihentikan. */
export function limitFor(
  limits: readonly BudgetLimit[],
  categoryId: ID,
  ym: YearMonth,
): Rupiah | null {
  let current: BudgetLimit | undefined;
  for (const limit of limits) {
    if (limit.categoryId !== categoryId || limit.effectiveFrom > ym) continue;
    if (!current || limit.effectiveFrom >= current.effectiveFrom) current = limit;
  }
  return current && current.amount > 0 ? current.amount : null;
}

export function budgetStatus(limit: Rupiah | null, spent: Rupiah): BudgetStatus {
  if (limit === null || limit <= 0) {
    return { limit: null, spent, remaining: null, ratio: null, status: 'none' };
  }
  const ratio = spent / limit;
  const status: BudgetStatusKind =
    ratio > 1 ? 'over' : ratio >= WARNING_RATIO ? 'warning' : 'ok';
  return { limit, spent, remaining: limit - spent, ratio, status };
}

/** Status semua kategori yang punya anggaran aktif pada bulan `ym`. */
export function budgetsForMonth(
  limits: readonly BudgetLimit[],
  spentByCategory: ReadonlyMap<ID, Rupiah>,
  ym: YearMonth,
): Map<ID, BudgetStatus> {
  const result = new Map<ID, BudgetStatus>();
  const categoryIds = new Set(limits.map((l) => l.categoryId));
  for (const categoryId of categoryIds) {
    const limit = limitFor(limits, categoryId, ym);
    if (limit === null) continue;
    result.set(categoryId, budgetStatus(limit, spentByCategory.get(categoryId) ?? 0));
  }
  return result;
}

/** Kategori paling berisiko untuk dashboard: rasio tertinggi dulu (≥ 80% otomatis di depan). */
export function riskiestBudgets(statuses: ReadonlyMap<ID, BudgetStatus>, limit = 3): Array<[ID, BudgetStatus]> {
  return [...statuses.entries()]
    .filter(([, s]) => s.ratio !== null)
    .sort((a, b) => b[1].ratio! - a[1].ratio!)
    .slice(0, limit);
}

export interface BudgetTotals {
  limit: Rupiah;
  spent: Rupiah;
}

export function sumBudgets(statuses: ReadonlyMap<ID, BudgetStatus>): BudgetTotals {
  let limit = 0;
  let spent = 0;
  for (const s of statuses.values()) {
    limit += s.limit ?? 0;
    spent += s.spent;
  }
  return { limit, spent };
}
