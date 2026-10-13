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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SummaryTile
                label="Pemasukan"
                value={summary.income}
                change={compareValues(summary.income, previous.income)}
                previousLabel={formatMonthShort(previousMonth)}
                to={`/transaksi?bulan=${month}&jenis=income`}
              />
              <SummaryTile
                label="Pengeluaran"
                value={summary.expense}
                change={compareValues(summary.expense, previous.expense)}
                previousLabel={formatMonthShort(previousMonth)}
                to={`/transaksi?bulan=${month}&jenis=expense`}
              />
              <SummaryTile
                label="Selisih"
                value={summary.net}
                change={compareValues(summary.net, previous.net)}
                previousLabel={formatMonthShort(previousMonth)}
              />
            </div>

            <Card>
              <h2 className="text-sm font-semibold text-slate-600">Pengeluaran per kategori</h2>
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
              <h2 className="mb-3 text-sm font-semibold text-slate-600">Tren 6 bulan</h2>
              <TrendChart data={trend} />
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function SummaryTile({
  label,
  value,
  change,
  previousLabel,
  to,
}: {
  label: string;
  value: number;
  change: PeriodChange;
  previousLabel: string;
  to?: string;
}) {
  const hidden = useAmountsHidden();
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <Money value={value} className="text-lg font-bold" />
      <p className="mt-0.5 text-xs text-slate-500">
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
  const className = 'block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
  return to ? (
    <Link to={to} className={`${className} hover:bg-slate-50`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
