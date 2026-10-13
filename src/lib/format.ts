import type { LocalDate, YearMonth } from '../domain/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** `2026-10` → `Oktober 2026`. */
export function formatMonth(ym: YearMonth): string {
  return `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

/** `2026-10-13` → `13 Okt 2026`. */
export function formatDisplayDate(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** `2026-10` → `Okt`. */
export function formatMonthShort(ym: YearMonth): string {
  return MONTHS[Number(ym.slice(5, 7)) - 1];
}

/** ISO timestamp → `13 Okt 2026, 21.30` (waktu lokal). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}
