import { MAX_AMOUNT, MIN_AMOUNT, type Rupiah } from '../domain/types';

export function isValidAmount(value: unknown): value is Rupiah {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_AMOUNT &&
    value <= MAX_AMOUNT
  );
}

const formatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** Teks input nominal → integer rupiah (hanya digit yang dipakai). Kosong → null. */
export function parseAmountInput(text: string): Rupiah | null {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return null;
  // Batasi panjang agar tidak melewati MAX_AMOUNT secara diam-diam saat mengetik.
  return Number(digits.slice(0, 13));
}

/** Integer rupiah → teks input dengan pemisah ribuan (`1.250.000`). */
export function formatAmountInput(value: Rupiah | null): string {
  return value === null ? '' : formatter.format(value);
}

/** `Rp1.250.000`, dengan tanda minus di depan untuk nilai negatif. */
export function formatRupiah(value: Rupiah): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}Rp${formatter.format(Math.abs(value))}`;
}

const compactFormatter = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

/** Angka ringkas untuk sumbu grafik: `5 jt`, `250 rb`. */
export function formatCompact(value: Rupiah): string {
  return compactFormatter.format(value);
}

/** Rasio → persen bulat: 0.123 → `12%`. */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
