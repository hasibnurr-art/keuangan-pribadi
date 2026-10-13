import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  clampedDate,
  diffDays,
  isValidLocalDate,
  isValidYearMonth,
  lastDayOfMonth,
  localDate,
  monthsBetween,
} from './date';
import { formatDisplayDate } from './format';
import { formatRupiah, isValidAmount } from './money';

describe('Tanggal lokal (tes berjalan di Asia/Jakarta)', () => {
  it('QA-20 transaksi pukul 23:30 WIB memakai tanggal lokal hari itu', () => {
    expect(localDate(new Date(2026, 9, 13, 23, 30))).toBe('2026-10-13');
  });

  it('QA-20 pukul 05:00 WIB (masih tanggal kemarin di UTC) tetap tanggal lokal', () => {
    const at = new Date(2026, 9, 14, 5, 0);
    expect(at.toISOString().slice(0, 10)).toBe('2026-10-13');
    expect(localDate(at)).toBe('2026-10-14');
  });

  it('validasi tanggal dan bulan', () => {
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2027-02-29')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('13-10-2026')).toBe(false);
    expect(isValidYearMonth('2026-10')).toBe(true);
    expect(isValidYearMonth('2026-00')).toBe(false);
  });

  it('aritmetika bulan dan hari', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(clampedDate('2026-04', 31)).toBe('2026-04-30');
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08');
    expect(diffDays('2026-10-01', '2026-10-13')).toBe(12);
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthsBetween('2026-11', '2026-10')).toEqual([]);
  });
});

describe('Format', () => {
  it('format rupiah Indonesia', () => {
    expect(formatRupiah(1_250_000)).toBe('Rp1.250.000');
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(-50_000)).toBe('−Rp50.000');
  });

  it('format tanggal tampilan', () => {
    expect(formatDisplayDate('2026-10-13')).toBe('13 Okt 2026');
    expect(formatDisplayDate('2027-05-01')).toBe('1 Mei 2027');
  });

  it('nominal valid hanya integer 1..1 triliun', () => {
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(1_000_000_000_000)).toBe(true);
    expect(isValidAmount('1000')).toBe(false);
    expect(isValidAmount(10.5)).toBe(false);
  });
});

describe('Pengaman rentang bulan', () => {
  it('rentang tidak valid atau terbalik menghasilkan daftar kosong', () => {
    expect(monthsBetween('2026-13', '2027-01')).toEqual([]);
    expect(monthsBetween('', '2027-01')).toEqual([]);
    expect(monthsBetween('2027-01', '2026-01')).toEqual([]);
  });

  it('rentang sangat panjang dibatasi 1200 bulan terakhir', () => {
    const months = monthsBetween('0001-01', '2026-10');
    expect(months).toHaveLength(1200);
    expect(months.at(-1)).toBe('2026-10');
    expect(months[0]).toBe('1926-11');
  });
});
