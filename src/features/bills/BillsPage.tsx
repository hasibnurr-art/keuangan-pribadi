// Tagihan rutin (PRD §9.9): Terlambat, Bulan ini, Bulan depan, lalu daftar semua tagihan.

import { useMemo } from 'react';
import { Link } from 'react-router';
import { useData } from '../../app/data';
import { billsOverview } from '../../domain/billRules';
import type { BillOccurrence } from '../../domain/bills';
import { addMonths, toYearMonth } from '../../lib/date';
import { formatMonth } from '../../lib/format';
import { ButtonLink, Card, EmptyState, Money, PageHeader } from '../../ui/controls';
import { BillOccurrenceItem } from './BillOccurrenceItem';
import { ICON, Invoice, Plus } from '../../ui/icons';

export function BillsPage() {
  const { bills, transactions, billSkips, today, accountsById } = useData();
  const overview = useMemo(() => billsOverview(bills, transactions, billSkips, today), [bills, transactions, billSkips, today]);
  const thisMonth = toYearMonth(today);
  const sortedBills = [...bills].sort((a, b) => Number(b.active) - Number(a.active) || a.dueDay - b.dueDay);

  return (
    <>
      <PageHeader title="Tagihan" back actions={<ButtonLink to="/tagihan/baru" variant="ghost"><Plus size={ICON.sm} weight="bold" /> Tambah</ButtonLink>} />
      <div className="flex flex-col gap-4 p-4">
        {bills.length === 0 ? (
          <Card>
            <EmptyState icon={Invoice} title="Belum ada tagihan rutin">
              <p className="mb-4">
                Catat tagihan bulanan seperti listrik, internet, cicilan, atau kartu kredit. Aplikasi akan mengingatkan
                saat jatuh tempo dan menghitungnya di Uang tersedia.
              </p>
              <ButtonLink to="/tagihan/baru">Tambah tagihan</ButtonLink>
            </EmptyState>
          </Card>
        ) : (
          <>
            <Section title="Terlambat" items={overview.overdue} empty={null} />
            <Section
              title={`Bulan ini · ${formatMonth(thisMonth)}`}
              items={overview.thisMonth}
              empty="Tidak ada tagihan bulan ini."
            />
            <Section
              title={`Bulan depan · ${formatMonth(addMonths(thisMonth, 1))}`}
              items={overview.nextMonth}
              empty="Tidak ada tagihan bulan depan."
            />

            <section aria-labelledby="all-bills">
              <h2 id="all-bills" className="mb-2 px-1 text-base font-bold tracking-tight">
                Semua tagihan
              </h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-surface">
                {sortedBills.map((bill) => (
                  <li key={bill.id}>
                    <Link to={`/tagihan/${bill.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 pressable">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {bill.name}
                          {!bill.active && <span className="ml-2 text-xs font-normal text-slate-500">(nonaktif)</span>}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          Tiap tanggal {bill.dueDay} · {accountsById.get(bill.accountId)?.name}
                          {bill.endMonth && ` · s.d. ${formatMonth(bill.endMonth)}`}
                        </p>
                      </div>
                      <Money value={bill.amount} prefix={bill.isVariable ? '≈ ' : ''} className="text-sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, items, empty }: { title: string; items: BillOccurrence[]; empty: string | null }) {
  if (items.length === 0 && empty === null) return null;
  return (
    <section aria-label={title}>
      <h2 className="mb-2 px-1 text-base font-bold tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-[20px] border border-slate-200 bg-surface px-4 py-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-surface">
          {items.map((o) => (
            <li key={`${o.bill.id}-${o.period}`}>
              <BillOccurrenceItem occurrence={o} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
