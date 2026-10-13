import type { YearMonth } from '../domain/types';
import { addMonths } from '../lib/date';
import { formatMonth } from '../lib/format';
import { CaretLeft, CaretRight, ICON } from './icons';

/** Pemilih bulan ‹ Oktober 2026 ›. Tidak bisa melewati `maxMonth`. */
export function MonthNav({
  value,
  onChange,
  maxMonth,
}: {
  value: YearMonth;
  onChange: (month: YearMonth) => void;
  maxMonth: YearMonth;
}) {
  const atMax = value >= maxMonth;
  const button = 'flex size-11 items-center justify-center rounded-full text-xl text-slate-700 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30';
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-1">
      <button type="button" aria-label="Bulan sebelumnya" className={button} onClick={() => onChange(addMonths(value, -1))}>
        <CaretLeft size={ICON.md} />
      </button>
      <p className="font-semibold" aria-live="polite">
        {formatMonth(value)}
      </p>
      <button
        type="button"
        aria-label="Bulan berikutnya"
        className={button}
        disabled={atMax}
        onClick={() => onChange(addMonths(value, 1))}
      >
        <CaretRight size={ICON.md} />
      </button>
    </div>
  );
}
