// Kategori default (PRD §9.6). ID tetap agar onboarding yang diulang tidak membuat duplikat.

import type { AccountGroup, AccountKind, Category } from './types';

type Seed = [id: string, name: string, icon: string, color: string];

const EXPENSE: Seed[] = [
  ['cat-makan', 'Makan & Minum', '🍜', 'orange'],
  ['cat-belanja-harian', 'Belanja Harian', '🛒', 'lime'],
  ['cat-transportasi', 'Transportasi', '🚗', 'sky'],
  ['cat-tagihan', 'Tagihan & Utilitas', '💡', 'amber'],
  ['cat-pulsa', 'Pulsa & Internet', '📱', 'indigo'],
  ['cat-kesehatan', 'Kesehatan', '🏥', 'rose'],
  ['cat-pendidikan', 'Pendidikan', '🎓', 'violet'],
  ['cat-rumah-tangga', 'Rumah Tangga', '🏠', 'teal'],
  ['cat-belanja-pribadi', 'Belanja Pribadi', '🛍️', 'pink'],
  ['cat-hiburan', 'Hiburan', '🎬', 'fuchsia'],
  ['cat-keluarga', 'Keluarga & Sosial', '🎁', 'red'],
  ['cat-zakat', 'Zakat & Sedekah', '🤲', 'emerald'],
  ['cat-biaya', 'Bunga & Biaya Admin', '🏦', 'slate'],
  ['cat-lainnya-keluar', 'Lainnya', '📦', 'stone'],
];

const INCOME: Seed[] = [
  ['cat-gaji', 'Gaji', '💼', 'emerald'],
  ['cat-bonus', 'Bonus & THR', '🎉', 'amber'],
  ['cat-usaha', 'Usaha Sampingan', '🧰', 'sky'],
  ['cat-hadiah', 'Hadiah', '🎁', 'pink'],
  ['cat-imbal-hasil', 'Bunga & Imbal Hasil', '📈', 'teal'],
  ['cat-lainnya-masuk', 'Lainnya', '📦', 'stone'],
];

export const DEFAULT_FEE_CATEGORY_ID = 'cat-biaya';

export const DEFAULT_CATEGORIES: Category[] = [
  ...EXPENSE.map(([id, name, icon, color], i): Category => ({
    id, name, icon, color, type: 'expense', archived: false, sortOrder: i,
  })),
  ...INCOME.map(([id, name, icon, color], i): Category => ({
    id, name, icon, color, type: 'income', archived: false, sortOrder: i,
  })),
];

export const CATEGORY_COLORS = [
  'slate', 'stone', 'red', 'orange', 'amber', 'lime', 'emerald', 'teal',
  'sky', 'indigo', 'violet', 'fuchsia', 'pink', 'rose',
] as const;

export const CATEGORY_ICONS = [
  '🍜', '☕', '🛒', '🚗', '⛽', '🏍️', '🚌', '💡', '💧', '📱', '🌐', '🏥', '💊', '🎓', '📚',
  '🏠', '🧹', '🛍️', '👕', '💄', '🎬', '🎮', '✈️', '🎁', '👶', '🐱', '🤲', '🕌', '🏦', '💳',
  '💼', '🎉', '🧰', '📈', '💰', '🧾', '🔧', '🏋️', '💇', '📦',
];

export const ACCOUNT_KINDS: Record<AccountGroup, { kind: AccountKind; label: string }[]> = {
  asset: [
    { kind: 'bank', label: 'Rekening bank' },
    { kind: 'cash', label: 'Tunai' },
    { kind: 'ewallet', label: 'E-wallet' },
    { kind: 'other_asset', label: 'Aset lain (deposito, emas, dll.)' },
  ],
  liability: [
    { kind: 'credit_card', label: 'Kartu kredit' },
    { kind: 'paylater', label: 'PayLater' },
    { kind: 'loan', label: 'Pinjaman / cicilan' },
    { kind: 'other_liability', label: 'Utang lain' },
  ],
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = Object.fromEntries(
  Object.values(ACCOUNT_KINDS).flat().map(({ kind, label }) => [kind, label]),
) as Record<AccountKind, string>;

export const ACCOUNT_KIND_ICON: Record<AccountKind, string> = {
  bank: '🏦',
  cash: '💵',
  ewallet: '📱',
  other_asset: '🪙',
  credit_card: '💳',
  paylater: '🧾',
  loan: '📄',
  other_liability: '📝',
};

/** Default "Hitung di Uang tersedia": aktif untuk tunai/bank/e-wallet. */
export function defaultIncludeInAvailable(kind: AccountKind): boolean {
  return kind === 'cash' || kind === 'bank' || kind === 'ewallet';
}

export function groupOfKind(kind: AccountKind): AccountGroup {
  return ACCOUNT_KINDS.asset.some((k) => k.kind === kind) ? 'asset' : 'liability';
}
