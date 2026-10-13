// Utilitas tanggal berbasis string. Tanggal transaksi TIDAK pernah dibuat lewat
// `new Date('YYYY-MM-DD')` (ditafsirkan sebagai UTC) agar tidak bergeser hari.

import type { LocalDate, YearMonth } from '../domain/types';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Tanggal lokal perangkat untuk sebuah instan waktu. */
export function localDate(at: Date = new Date()): LocalDate {
  return `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

export function isValidLocalDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isValidYearMonth(value: string): boolean {
  const m = MONTH_RE.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function toYearMonth(date: LocalDate): YearMonth {
  return date.slice(0, 7);
}

function parseYearMonth(ym: YearMonth): [number, number] {
  return [Number(ym.slice(0, 4)), Number(ym.slice(5, 7))];
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const [y, m] = parseYearMonth(ym);
  const index = y * 12 + (m - 1) + n;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

export function firstDayOfMonth(ym: YearMonth): LocalDate {
  return `${ym}-01`;
}

export function lastDayOfMonth(ym: YearMonth): LocalDate {
  const [y, m] = parseYearMonth(ym);
  return `${ym}-${pad(daysInMonth(y, m))}`;
}

/** Tanggal pada bulan `ym` dengan hari `day`, dipotong ke hari terakhir bulan. */
export function clampedDate(ym: YearMonth, day: number): LocalDate {
  const [y, m] = parseYearMonth(ym);
  return `${ym}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Selisih hari (b − a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const toUtc = (s: LocalDate) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Daftar bulan dari `from` sampai `to` (inklusif). */
export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  if (!isValidYearMonth(from) || !isValidYearMonth(to) || from > to) return [];
  // Pengaman: rentang dibatasi MAX_MONTH_SPAN bulan terakhir agar data aneh tidak membekukan aplikasi.
  const earliest = addMonths(to, -(MAX_MONTH_SPAN - 1));
  const out: YearMonth[] = [];
  for (let ym = from < earliest ? earliest : from; ym <= to && out.length < MAX_MONTH_SPAN; ym = addMonths(ym, 1)) {
    out.push(ym);
  }
  return out;
}

/** Tidak ada rentang bulan yang wajar melebihi 100 tahun. */
export const MAX_MONTH_SPAN = 1200;
