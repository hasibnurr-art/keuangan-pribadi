import { describe, expect, it } from 'vitest';
import { budgetStatus, budgetsForMonth, limitFor } from './budget';
import type { BudgetLimit } from './types';

const limit = (over: Partial<BudgetLimit> & Pick<BudgetLimit, 'effectiveFrom' | 'amount'>): BudgetLimit => ({
  id: `${over.effectiveFrom}-${over.amount}`,
  categoryId: 'makan',
  ...over,
});

describe('Anggaran', () => {
  it('QA-11 tanpa anggaran atau batas 0: tidak ada pembagian dengan nol', () => {
    expect(budgetStatus(null, 50_000)).toEqual({ limit: null, spent: 50_000, remaining: null, ratio: null, status: 'none' });
    expect(budgetStatus(0, 50_000).status).toBe('none');
    expect(limitFor([], 'makan', '2026-10')).toBeNull();
  });

  it('QA-24 mengubah batas bulan ini tidak mengubah batas bulan lalu', () => {
    const limits = [
      limit({ effectiveFrom: '2026-08', amount: 2_000_000 }),
      limit({ effectiveFrom: '2026-10', amount: 2_500_000 }),
    ];
    expect(limitFor(limits, 'makan', '2026-07')).toBeNull();
    expect(limitFor(limits, 'makan', '2026-09')).toBe(2_000_000);
    expect(limitFor(limits, 'makan', '2026-10')).toBe(2_500_000);
    expect(limitFor(limits, 'makan', '2027-03')).toBe(2_500_000);
  });

  it('batas 0 menghentikan anggaran mulai bulan itu', () => {
    const limits = [
      limit({ effectiveFrom: '2026-08', amount: 2_000_000 }),
      limit({ effectiveFrom: '2026-10', amount: 0 }),
    ];
    expect(limitFor(limits, 'makan', '2026-09')).toBe(2_000_000);
    expect(limitFor(limits, 'makan', '2026-10')).toBeNull();
  });

  it('status: aman < 80%, hampir habis 80–100%, terlampaui > 100%', () => {
    expect(budgetStatus(1_000_000, 799_999).status).toBe('ok');
    expect(budgetStatus(1_000_000, 800_000).status).toBe('warning');
    expect(budgetStatus(1_000_000, 1_000_000).status).toBe('warning');
    const over = budgetStatus(1_000_000, 1_120_000);
    expect(over.status).toBe('over');
    expect(over.remaining).toBe(-120_000);
  });

  it('budgetsForMonth hanya memuat kategori dengan anggaran aktif', () => {
    const limits = [
      limit({ effectiveFrom: '2026-10', amount: 1_000_000 }),
      limit({ categoryId: 'hiburan', effectiveFrom: '2026-11', amount: 500_000 }),
    ];
    const result = budgetsForMonth(limits, new Map([['makan', 900_000]]), '2026-10');
    expect([...result.keys()]).toEqual(['makan']);
    expect(result.get('makan')?.status).toBe('warning');
  });
});
