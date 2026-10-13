// Sesuaikan saldo (PRD §9.5): selisih saldo aplikasi vs saldo sebenarnya
// dicatat sebagai transaksi `adjustment`, bukan pemasukan/pengeluaran.

import type { AdjustDirection, ID, LocalDate, Rupiah } from './types';

export interface AdjustmentPlan {
  accountId: ID;
  date: LocalDate;
  amount: Rupiah;
  adjustDirection: AdjustDirection;
  /** actual − current, untuk ditampilkan ke pengguna. */
  difference: Rupiah;
}

export function planAdjustment(
  accountId: ID,
  currentBalance: Rupiah,
  actualBalance: Rupiah,
  today: LocalDate,
): AdjustmentPlan | null {
  const difference = actualBalance - currentBalance;
  if (difference === 0) return null;
  return {
    accountId,
    date: today,
    amount: Math.abs(difference),
    adjustDirection: difference > 0 ? 'increase' : 'decrease',
    difference,
  };
}
