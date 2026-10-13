// Visualisasi M3. Palet tervalidasi (dataviz validator, light):
//   seri 1 Pemasukan #2a78d6, seri 2 Pengeluaran #eb6834 — CVD ΔE 24.7, normal ΔE 33.6.
// Status anggaran memakai palet status (selalu dengan ikon + teks, bukan warna saja).

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { BudgetStatus } from '../domain/budget';
import type { Rupiah, YearMonth } from '../domain/types';
import { formatMonth, formatMonthShort } from '../lib/format';
import { formatCompact, formatPercent } from '../lib/money';
import { CategoryBadge } from './CategoryBadge';
import { Money, cx, useAmountsHidden } from './controls';
import { Check, ICON, Warning, X } from './icons';

export const SERIES = { income: 'var(--color-series-income)', expense: 'var(--color-series-expense)' } as const;
const GRID = 'var(--color-chart-grid)';
const AXIS_TEXT = 'var(--color-chart-axis)';

// ---------------------------------------------------------------- Tren 6 bulan

export interface TrendPoint {
  month: YearMonth;
  income: Rupiah;
  expense: Rupiah;
}

/** Langkah sumbu "bersih": 1, 2, 2.5, 5 × 10^k. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v < max + step && ticks.length <= count + 2; v += step) {
    ticks.push(v);
    if (v >= max) break;
  }
  return ticks;
}

/** Batang dengan ujung data membulat 4px dan pangkal persegi di garis dasar. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(340);
  const [active, setActive] = useState<number | null>(null);
  const hidden = useAmountsHidden();

  const height = 200;
  const margin = { top: 12, right: 4, bottom: 24, left: 44 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const max = Math.max(0, ...data.flatMap((d) => [d.income, d.expense]));
  const ticks = niceTicks(max);
  const top = ticks.at(-1) || 1;
  const band = plotW / data.length;
  const barW = Math.max(4, Math.min(24, (band - 16 - 2) / 2));
  const y = (v: number) => margin.top + plotH - (Math.max(0, v) / top) * plotH;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex gap-4 text-sm text-slate-700" aria-label="Legenda">
        {(['income', 'expense'] as const).map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: SERIES[key] }} />
            {key === 'income' ? 'Pemasukan' : 'Pengeluaran'}
          </li>
        ))}
      </ul>

      <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Grafik batang pemasukan dan pengeluaran per bulan. Angka lengkap ada di tabel di bawahnya."
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={margin.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} className="tabular">
                {hidden && t > 0 ? '•••' : formatCompact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx0 = margin.left + band * i + band / 2;
            const x1 = cx0 - barW - 1;
            const x2 = cx0 + 1;
            return (
              <g key={d.month}>
                {active === i && <rect x={margin.left + band * i} y={margin.top} width={band} height={plotH} fill="#f1f5f9" />}
                <path d={barPath(x1, y(d.income), barW, y(0) - y(d.income))} fill={SERIES.income} />
                <path d={barPath(x2, y(d.expense), barW, y(0) - y(d.expense))} fill={SERIES.expense} />
                <text x={cx0} y={height - 6} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                  {formatMonthShort(d.month)}
                </text>
                <rect
                  x={margin.left + band * i}
                  y={margin.top}
                  width={band}
                  height={plotH + margin.bottom}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              </g>
            );
          })}
        </svg>

        {active !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-lg"
            style={{
              // Di samping kelompok yang disorot agar tidak menutupi batangnya.
              left:
                margin.left + band * (active + 1) + 180 <= width
                  ? margin.left + band * (active + 1) + 4
                  : Math.max(0, margin.left + band * active - 180),
            }}
          >
            <p className="mb-1 font-semibold text-slate-900">{formatMonth(data[active].month)}</p>
            {(['income', 'expense'] as const).map((key) => (
              <p key={key} className="flex items-center justify-between gap-2 text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-sm" style={{ background: SERIES[key] }} />
                  {key === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                </span>
                <Money value={data[active][key]} />
              </p>
            ))}
          </div>
        )}
      </div>

      <table className="w-full text-xs sm:text-sm">
        <caption className="sr-only">Pemasukan dan pengeluaran per bulan</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th scope="col" className="py-1.5 font-medium">Bulan</th>
            <th scope="col" className="py-1.5 text-right font-medium">Pemasukan</th>
            <th scope="col" className="py-1.5 text-right font-medium">Pengeluaran</th>
            <th scope="col" className="py-1.5 text-right font-medium">Selisih</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[...data].reverse().map((d) => (
            <tr key={d.month}>
              <th scope="row" className="py-1.5 text-left font-normal text-slate-700">
                {formatMonthShort(d.month)} {d.month.slice(0, 4)}
              </th>
              <td className="py-1.5 text-right">
                <Money value={d.income} />
              </td>
              <td className="py-1.5 text-right">
                <Money value={d.expense} />
              </td>
              <td className="py-1.5 text-right font-medium">
                <Money value={d.income - d.expense} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Per kategori

export interface CategoryBarItem {
  key: string;
  icon: string;
  color: string;
  name: string;
  amount: Rupiah;
  share: number;
  to: string;
}

/** Satu seri (magnitudo): satu warna, tanpa legenda; nilai & persen di setiap baris. */
export function CategoryBars({ items }: { items: CategoryBarItem[] }) {
  const maxShare = Math.max(...items.map((i) => i.share), 0) || 1;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.key}>
          <Link to={item.to} className="flex items-center gap-3 py-2.5 pressable">
            <CategoryBadge icon={item.icon} color={item.color} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{item.name}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <Money value={item.amount} className="font-semibold" />
                  <span className="tabular w-9 text-right text-xs text-slate-500">
                    {item.amount > 0 ? formatPercent(item.share) : '—'}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100" aria-hidden>
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${(item.share / maxShare) * 100}%`, background: SERIES.income }}
                />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- Anggaran

const STATUS_STYLE = {
  ok: { fill: 'var(--color-good)', track: 'var(--color-good-tint)', icon: Check, label: 'Aman', ink: '#ffffff' },
  warning: { fill: 'var(--color-warn)', track: 'var(--color-warn-tint)', icon: Warning, label: 'Hampir habis', ink: '#0f172a' },
  over: { fill: 'var(--color-bad)', track: 'var(--color-bad-tint)', icon: X, label: 'Terlampaui', ink: '#ffffff' },
} as const;

export function BudgetMeter({ status }: { status: BudgetStatus }) {
  if (status.status === 'none' || status.ratio === null) return null;
  const style = STATUS_STYLE[status.status];
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(status.ratio * 100)}
      aria-valuetext={`${formatPercent(status.ratio)} terpakai`}
      className="h-2 overflow-hidden rounded-full"
      style={{ background: style.track }}
    >
      <div className="h-2 rounded-full" style={{ width: `${Math.min(1, status.ratio) * 100}%`, background: style.fill }} />
    </div>
  );
}

/** Label status: ikon + teks (tidak bergantung pada warna). */
export function BudgetStatusLabel({ status, className }: { status: BudgetStatus; className?: string }) {
  if (status.status === 'none' || status.remaining === null) return null;
  const style = STATUS_STYLE[status.status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs text-slate-700', className)}>
      <span
        aria-hidden
        className="flex size-4 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: style.fill, color: style.ink }}
      >
        <style.icon size={ICON.xs} weight="bold" />
      </span>
      {status.status === 'over' ? (
        <>
          Terlampaui <Money value={-status.remaining} />
        </>
      ) : (
        <>
          {style.label} · sisa <Money value={status.remaining} />
        </>
      )}
    </span>
  );
}
