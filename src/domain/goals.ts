// Target tabungan (PRD §9.14). 1 target = 1 akun aset khusus; progres = saldo akun itu,
// sehingga uang tidak pernah terhitung dua kali dan menabung cukup dicatat sebagai Transfer.
//
// Konvensi bulan: setoran dianggap terjadi sekali per bulan, TERMASUK bulan berjalan.
// Jadi "sisa bulan" Okt→Des = 3 (Okt, Nov, Des).

import { addMonths, diffDays, isValidYearMonth, lastDayOfMonth, monthsBetween, toYearMonth } from '../lib/date';
import { isValidAmount } from '../lib/money';
import { effectOnAccount } from './balance';
import { monthSummary } from './report';
import type { Account, Goal, ID, LocalDate, Rupiah, Transaction, YearMonth } from './types';

export const MAX_GOAL_NAME = 40;
export const MILESTONES = [25, 50, 75, 100] as const;
/** Toleransi status jadwal, relatif terhadap jumlah target. */
const BEHIND_TOLERANCE = 0.01;
const AHEAD_MARGIN = 0.05;

export interface GoalProgress {
  saved: Rupiah;
  remaining: Rupiah;
  /** 0..1 */
  ratio: number;
  done: boolean;
}

export function goalProgress(goal: Goal, balance: Rupiah): GoalProgress {
  const saved = Math.max(0, balance);
  const remaining = Math.max(0, goal.targetAmount - saved);
  return { saved, remaining, ratio: Math.min(1, saved / goal.targetAmount), done: remaining === 0 };
}

/** Jumlah bulan setoran tersisa dari bulan berjalan s.d. bulan target (inklusif); 0 jika sudah lewat. */
export function monthsLeft(targetMonth: YearMonth, today: LocalDate): number {
  return monthsBetween(toYearMonth(today), targetMonth).length;
}

/** Setoran per bulan agar tercapai tepat waktu (dibulatkan ke atas). Seluruh sisa jika tenggat lewat. */
export function requiredPerMonth(remaining: Rupiah, targetMonth: YearMonth, today: LocalDate): Rupiah {
  if (remaining <= 0) return 0;
  const months = monthsLeft(targetMonth, today);
  return months === 0 ? remaining : Math.ceil(remaining / months);
}

export type ScheduleStatus = 'done' | 'ahead' | 'on_track' | 'behind' | 'overdue';

export interface Schedule {
  status: ScheduleStatus;
  /** Progres yang seharusnya sudah dicapai hari ini (garis lurus dari awal ke tenggat). */
  expected: Rupiah;
  /** saved − expected; negatif berarti tertinggal. */
  difference: Rupiah;
}

export function goalSchedule(goal: Goal, saved: Rupiah, today: LocalDate): Schedule {
  const deadline = lastDayOfMonth(goal.targetMonth);
  const total = Math.max(1, diffDays(goal.startDate, deadline));
  const elapsed = Math.min(total, Math.max(0, diffDays(goal.startDate, today)));
  const expected = Math.round(goal.startAmount + (goal.targetAmount - goal.startAmount) * (elapsed / total));
  const difference = saved - expected;

  let status: ScheduleStatus;
  if (saved >= goal.targetAmount) status = 'done';
  else if (today > deadline) status = 'overdue';
  else if (difference < -BEHIND_TOLERANCE * goal.targetAmount) status = 'behind';
  else if (difference > AHEAD_MARGIN * goal.targetAmount) status = 'ahead';
  else status = 'on_track';
  return { status, expected, difference };
}

/** Perubahan saldo bersih akun per bulan (setoran, penarikan, penyesuaian nilai). */
function netChangeInMonth(account: Account, transactions: readonly Transaction[], month: YearMonth): Rupiah {
  let total = 0;
  for (const tx of transactions) {
    if (toYearMonth(tx.date) === month && tx.date >= account.openingDate) total += effectOnAccount(tx, account);
  }
  return total;
}

/**
 * Rata-rata pertambahan saldo per bulan pada (maks.) 3 bulan penuh terakhir sejak akun dibuka.
 * null jika belum ada satu bulan penuh pun.
 */
export function averageMonthlyGrowth(account: Account, transactions: readonly Transaction[], today: LocalDate): Rupiah | null {
  const lastFull = addMonths(toYearMonth(today), -1);
  const firstAllowed = toYearMonth(account.openingDate);
  const months = monthsBetween(addMonths(lastFull, -2), lastFull).filter((m) => m >= firstAllowed);
  if (months.length === 0) return null;
  const total = months.reduce((sum, m) => sum + netChangeInMonth(account, transactions, m), 0);
  return Math.round(total / months.length);
}

/** Bulan tercapai jika menabung `perMonth` setiap bulan mulai bulan ini; null jika perMonth ≤ 0. */
export function completionMonth(remaining: Rupiah, perMonth: Rupiah, today: LocalDate): YearMonth | null {
  const thisMonth = toYearMonth(today);
  if (remaining <= 0) return thisMonth;
  if (perMonth <= 0) return null;
  return addMonths(thisMonth, Math.ceil(remaining / perMonth) - 1);
}

/** Tonggak tertinggi yang sudah dilewati (25/50/75/100), atau null. */
export function reachedMilestone(ratio: number): (typeof MILESTONES)[number] | null {
  const percent = Math.floor(ratio * 100);
  return [...MILESTONES].reverse().find((m) => percent >= m) ?? null;
}

export const MILESTONE_MESSAGE: Record<(typeof MILESTONES)[number], string> = {
  25: 'Seperempat jalan sudah terlewati. Pertahankan ritmenya!',
  50: 'Setengah jalan! Separuh target sudah terkumpul.',
  75: 'Tinggal seperempat lagi. Garis finis sudah dekat.',
  100: 'Target tercapai! Selamat 🎉',
};

/**
 * Saran Dana Darurat = rata-rata pengeluaran 3 bulan penuh terakhir × `multiplier`,
 * dibulatkan ke atas ke Rp100.000. null jika belum ada data pengeluaran.
 */
export function emergencyFundSuggestion(
  transactions: readonly Transaction[],
  today: LocalDate,
  multiplier = 6,
): { monthlyExpense: Rupiah; amount: Rupiah; months: number } | null {
  const lastFull = addMonths(toYearMonth(today), -1);
  const candidates = monthsBetween(addMonths(lastFull, -2), lastFull);
  const withData = candidates.filter((m) => monthSummary(transactions, m).expense > 0);
  // Belum ada bulan penuh: pakai bulan berjalan sebagai perkiraan kasar.
  const months = withData.length > 0 ? withData : [toYearMonth(today)];
  const total = months.reduce((sum, m) => sum + monthSummary(transactions, m).expense, 0);
  if (total <= 0) return null;
  const monthlyExpense = Math.round(total / months.length);
  // Kalikan dari total (bukan rata-rata yang sudah dibulatkan) agar tidak naik satu langkah pembulatan.
  const exact = (total * multiplier) / months.length;
  return { monthlyExpense, amount: Math.ceil(exact / 100_000) * 100_000, months: months.length };
}

// ---------------------------------------------------------------- Validasi

export type GoalDraft = Pick<Goal, 'id' | 'name' | 'icon' | 'kind' | 'targetAmount' | 'targetMonth' | 'accountId'>;
export type GoalErrors = Partial<Record<keyof GoalDraft, string>>;

export function validateGoal(
  draft: GoalDraft,
  ctx: { accountsById: ReadonlyMap<ID, Account>; goals: readonly Goal[]; today: LocalDate; isNew: boolean },
): GoalErrors {
  const errors: GoalErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Nama target wajib diisi.';
  else if (name.length > MAX_GOAL_NAME) errors.name = `Nama target maksimal ${MAX_GOAL_NAME} karakter.`;

  if (!isValidAmount(draft.targetAmount)) errors.targetAmount = 'Jumlah target harus antara Rp1 dan Rp1.000.000.000.000.';

  if (!isValidYearMonth(draft.targetMonth)) errors.targetMonth = 'Bulan target tidak valid.';
  else if (ctx.isNew && draft.targetMonth < toYearMonth(ctx.today)) errors.targetMonth = 'Bulan target tidak boleh sebelum bulan ini.';

  const account = ctx.accountsById.get(draft.accountId);
  if (!account) errors.accountId = 'Pilih akun tabungan.';
  else if (account.group !== 'asset') errors.accountId = 'Akun tabungan harus akun aset, bukan utang.';
  else if (ctx.isNew && account.archived) errors.accountId = `Akun ${account.name} sudah diarsipkan.`;
  else {
    const other = ctx.goals.find((g) => g.id !== draft.id && !g.archived && g.accountId === draft.accountId);
    if (other) errors.accountId = `Akun ini sudah dipakai target "${other.name}". Satu akun hanya untuk satu target.`;
  }
  return errors;
}
