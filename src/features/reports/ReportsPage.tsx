// Laporan (PRD §9.11): ringkasan bulan + perbandingan, per kategori, tren 6 bulan.

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../../app/data';
import { categoryBreakdown, compareValues, monthSummary, monthlyTrend, type PeriodChange } from '../../domain/report';
import { addMonths, toYearMonth } from '../../lib/date';
import { formatMonthShort } from '../../lib/format';
import { formatPercent } from '../../lib/money';
import { MonthNav } from '../../ui/MonthNav';
import { CategoryBars, TrendChart } from '../../ui/charts';
import { Card, EmptyState, Money, PageHeader, useAmountsHidden } from '../../ui/controls';
import { CaretDown, CaretUp, ChartBar, ICON } from '../../ui/icons';

export function ReportsPage() {
  const { transactions, categoriesById, today } = useData();
  const thisMonth = toYearMonth(today);
  const [month, setMonth] = useState(thisMonth);
  const previousMonth = addMonths(month, -1);

  const summary = useMemo(() => monthSummary(transactions, month), [transactions, month]);
  const previous = useMemo(() => monthSummary(transactions, previousMonth), [transactions, previousMonth]);
  const breakdown = useMemo(() => categoryBreakdown(transactions, month), [transactions, month]);
  const trend = useMemo(() => monthlyTrend(transactions, month, 6), [transactions, month]);

  const items = breakdown.map(({ categoryId, amount, share }) => {
    const category = categoriesById.get(categoryId);
    return {
      key: categoryId,
      icon: category?.icon ?? '📦',
      color: category?.color ?? 'slate',
      name: category?.name ?? 'Kategori terhapus',
      amount,
      share,
      to: `/transaksi?bulan=${month}&kategori=${categoryId}`,
    };
  });

  return (
    <>
      <PageHeader title="Laporan" />
      <div className="flex flex-col gap-4 p-4">
        <MonthNav value={month} onChange={setMonth} maxMonth={thisMonth} />

        {transactions.length === 0 ? (
          <Card>
            <EmptyState icon={ChartBar} title="Belum ada data untuk dilaporkan">
              Laporan muncul setelah Anda mencatat transaksi.
            </EmptyState>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SummaryTile
                dot="var(--color-series-income)"
                label="Pemasukan"
                value={summary.income}
                change={compareValues(summary.income, previous.income)}
                previousLabel={formatMonthShort(previousMonth)}
                to={`/transaksi?bulan=${month}&jenis=income`}
              />
              <SummaryTile
                dot="var(--color-series-expense)"
                label="Pengeluaran"
                value={summary.expense}
                change={compareValues(summary.expense, previous.expense)}
                previousLabel={formatMonthShort(previousMonth)}
                to={`/transaksi?bulan=${month}&jenis=expense`}
              />
              <SummaryTile
                wide
                label="Selisih"
                value={summary.net}
                change={compareValues(summary.net, previous.net)}
                previousLabel={formatMonthShort(previousMonth)}
              />
            </div>

            <Card>
              <h2 className="text-base font-bold tracking-tight">Pengeluaran per kategori</h2>
              <p className="mb-2 text-xs text-slate-500">
                Belanja kartu kredit dihitung saat belanja, bukan saat tagihan dibayar. Refund mengurangi kategori asal.
              </p>
              {items.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">Tidak ada pengeluaran di bulan ini.</p>
              ) : (
                <CategoryBars items={items} />
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-base font-bold tracking-tight">Tren 6 bulan</h2>
              <TrendChart data={trend} />
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function SummaryTile({
  dot,
  wide,
  label,
  value,
  change,
  previousLabel,
  to,
}: {
  dot?: string;
  wide?: boolean;
  label: string;
  value: number;
  change: PeriodChange;
  previousLabel: string;
  to?: string;
}) {
  const hidden = useAmountsHidden();
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {dot && <span aria-hidden className="size-2 rounded-full" style={{ background: dot }} />}
        {label}
      </p>
      <Money value={value} prefix={wide && value > 0 ? '+' : ''} className="mt-0.5 block text-lg font-extrabold tracking-tight" />
      <p className="mt-1 text-xs text-slate-500">
        {change.delta === 0 ? (
          `Sama dengan ${previousLabel}`
        ) : (
          <>
            {change.delta > 0 ? <CaretUp size={ICON.xs} weight="bold" className="inline align-baseline" /> : <CaretDown size={ICON.xs} weight="bold" className="inline align-baseline" />}{' '}
            <span className="sr-only">{change.delta > 0 ? 'Naik' : 'Turun'} </span>
            <Money value={Math.abs(change.delta)} />
            {!hidden && change.ratio !== null && ` (${formatPercent(Math.abs(change.ratio))})`} dari {previousLabel}
          </>
        )}
      </p>
    </>
  );
  const className = `block min-w-0 rounded-[20px] border border-slate-200 bg-surface p-4 ${wide ? 'col-span-2 sm:col-span-1' : ''}`;
  return to ? (
    <Link to={to} className={`${className} pressable`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
