// Model data sesuai PRD v2.0 §7. Semua nominal adalah integer rupiah.

export type ID = string;
/** Tanggal lokal perangkat, format 'YYYY-MM-DD'. */
export type LocalDate = string;
/** Bulan kalender, format 'YYYY-MM'. */
export type YearMonth = string;
/** Integer rupiah, tanpa desimal. */
export type Rupiah = number;

export type AccountGroup = 'asset' | 'liability';
export type AccountKind =
  | 'cash'
  | 'bank'
  | 'ewallet'
  | 'other_asset'
  | 'credit_card'
  | 'paylater'
  | 'loan'
  | 'other_liability';

export interface Account {
  id: ID;
  name: string;
  group: AccountGroup;
  kind: AccountKind;
  /** ≥ 0. Aset = uang dimiliki; Utang = jumlah terutang. */
  openingBalance: Rupiah;
  /** Saldo awal berlaku pada awal hari ini. */
  openingDate: LocalDate;
  /** Dihitung di "Uang tersedia" (hanya bermakna untuk aset). */
  includeInAvailable: boolean;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: ID;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  archived: boolean;
  sortOrder: number;
}

export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';
export type AdjustDirection = 'increase' | 'decrease';

export interface Transaction {
  id: ID;
  type: TransactionType;
  date: LocalDate;
  /** Selalu > 0. */
  amount: Rupiah;
  /** income: akun tujuan; expense/adjustment: akun terkait; transfer: akun asal. */
  accountId: ID;
  /** Hanya transfer. */
  toAccountId?: ID;
  /** income/expense wajib; refund → kategori PENGELUARAN. */
  categoryId?: ID;
  /** Hanya income. */
  isRefund?: boolean;
  /** Hanya adjustment, arah terhadap saldo natural. */
  adjustDirection?: AdjustDirection;
  note?: string;
  /** Menghubungkan transfer dengan biaya tambahannya. */
  groupId?: ID;
  billId?: ID;
  billPeriod?: YearMonth;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetLimit {
  id: ID;
  categoryId: ID;
  effectiveFrom: YearMonth;
  /** 0 = anggaran dihentikan mulai bulan ini. */
  amount: Rupiah;
}

export type BillKind = 'expense' | 'transfer';

export interface Bill {
  id: ID;
  name: string;
  kind: BillKind;
  amount: Rupiah;
  isVariable: boolean;
  /** 1–31; dipotong ke hari terakhir bulan bila perlu. */
  dueDay: number;
  accountId: ID;
  toAccountId?: ID;
  categoryId?: ID;
  startMonth: YearMonth;
  endMonth?: YearMonth;
  active: boolean;
  note?: string;
}

export interface BillSkip {
  billId: ID;
  period: YearMonth;
}

export interface Setting {
  key: string;
  value: unknown;
}

export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 1_000_000_000_000;
export const MAX_NOTE_LENGTH = 200;
