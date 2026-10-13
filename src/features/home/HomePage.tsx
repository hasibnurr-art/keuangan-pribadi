// Dashboard (PRD §9.10). Urutan: Uang tersedia → Bulan ini → Anggaran → Akun → Transaksi terbaru.
// Banner backup (M5) dan daftar tagihan (M4) ditambahkan di milestone berikutnya.

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../../app/data';
import { availableMoney, dueSoon } from '../../domain/bills';
import { budgetsForMonth, riskiestBudgets } from '../../domain/budget';
import { sortNewestFirst } from '../../domain/history';
import { expenseByCategory, monthSummary } from '../../domain/report';
import { db } from '../../db';
import { setSetting } from '../../db/settings';
import { toYearMonth } from '../../lib/date';
import { formatDisplayDate, formatMonth } from '../../lib/format';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { Dialog } from '../../ui/Dialog';
import { TransactionRow } from '../../ui/TransactionRow';
import { BudgetMeter, BudgetStatusLabel } from '../../ui/charts';
import { BillOccurrenceItem } from '../bills/BillOccurrenceItem';
import { BackupBanner } from '../data/BackupBanner';
import { ButtonLink, Card, EmptyState, Money, PageHeader, useAmountsHidden } from '../../ui/controls';

export function HomePage() {
  const { transactions, today } = useData();
  const hidden = useAmountsHidden();
  const recent = useMemo(() => sortNewestFirst(transactions).slice(0, 5), [transactions]);

  return (
    <>
      <PageHeader
        title="Beranda"
        actions={
          <button
            type="button"
            aria-pressed={hidden}
            aria-label={hidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
            title={hidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
            className="flex size-11 items-center justify-center rounded-full text-xl hover:bg-slate-200"
            onClick={() => setSetting(db, 'hideAmounts', !hidden)}
          >
            <span aria-hidden>{hidden ? '🙈' : '👁'}</span>
          </button>
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <BackupBanner />
        <AvailableCard />
        <ThisMonthCard month={toYearMonth(today)} />
        <BillsCard />
        <BudgetCard month={toYearMonth(today)} />
        <AccountsCard />

        <section aria-labelledby="recent">
          <h2 id="recent" className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-slate-600">
            <span>Transaksi terbaru</span>
            {recent.length > 0 && (
              <ButtonLink to="/transaksi" variant="ghost" className="min-h-9">
                Lihat semua
              </ButtonLink>
            )}
          </h2>
          {recent.length === 0 ? (
            <Card>
              <EmptyState icon="📝" title="Belum ada transaksi">
                Ketuk + untuk mencatat transaksi pertama Anda.
              </EmptyState>
            </Card>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {recent.map((tx) => (
                <li key={tx.id}>
                  <TransactionRow tx={tx} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function AvailableCard() {
  const { accounts, balances, totals, bills, billSkips, transactions, today } = useData();
  const [open, setOpen] = useState(false);
  const result = useMemo(
    () => availableMoney(accounts, totals.totalCash, bills, transactions, billSkips, today),
    [accounts, totals.totalCash, bills, transactions, billSkips, today],
  );
  const cashAccounts = accounts.filter((a) => a.group === 'asset' && a.includeInAvailable && !a.archived);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-brand-800 p-5 text-left text-white shadow-sm hover:bg-brand-900"
      >
        <span className="block text-sm text-brand-100">Uang tersedia</span>
        <Money value={result.available} tabular={false} className="block text-[clamp(2rem,10vw,3rem)] leading-tight font-bold" />
        <span className="mt-1 block text-sm text-brand-100">
          {result.pendingBills.length > 0
            ? 'setelah tagihan s.d. akhir bulan · ketuk untuk rincian'
            : 'total kas · ketuk untuk rincian'}
        </span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Rincian uang tersedia">
        <div className="flex flex-col gap-4 text-sm">
          <section>
            <h3 className="mb-1 font-semibold text-slate-700">Kas</h3>
            {cashAccounts.length === 0 ? (
              <p className="text-slate-500">Belum ada akun yang dihitung di Uang tersedia.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cashAccounts.map((a) => (
                  <li key={a.id} className="flex justify-between py-1.5">
                    <span>{a.name}</span>
                    <Money value={balances.get(a.id) ?? 0} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 font-semibold">
              <span>Total kas</span>
              <Money value={result.totalCash} />
            </p>
          </section>
          <section>
            <h3 className="mb-1 font-semibold text-slate-700">Tagihan belum dibayar s.d. akhir bulan</h3>
            {result.pendingBills.length === 0 ? (
              <p className="text-slate-500">Tidak ada tagihan yang menunggu.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {result.pendingBills.map((o) => (
                  <li key={`${o.bill.id}-${o.period}`} className="flex justify-between py-1.5">
                    <span>
                      {o.bill.name}
                      <span className="block text-xs text-slate-500">
                        {o.status === 'overdue' ? 'Terlambat · ' : ''}jatuh tempo {formatDisplayDate(o.dueDate)}
                      </span>
                    </span>
                    <Money value={-o.bill.amount} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="flex justify-between rounded-xl bg-brand-50 p-3 text-base font-bold text-brand-900">
            <span>Uang tersedia</span>
            <Money value={result.available} />
          </p>
          <p className="text-xs text-slate-500">
            Akun deposito, emas, dan akun lain yang tidak dicentang &quot;Hitung di Uang tersedia&quot; tidak ikut dihitung.
          </p>
        </div>
      </Dialog>
    </>
  );
}

function ThisMonthCard({ month }: { month: string }) {
  const { transactions } = useData();
  const summary = useMemo(() => monthSummary(transactions, month), [transactions, month]);
  return (
    <Link to="/laporan" className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50">
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>{formatMonth(month)}</span>
        <span className="font-normal text-brand-700">Laporan ›</span>
      </h2>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-slate-500">Pemasukan</dt>
          <dd className="font-semibold">
            <Money value={summary.income} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Pengeluaran</dt>
          <dd className="font-semibold">
            <Money value={summary.expense} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Selisih</dt>
          <dd className="font-semibold">
            <Money value={summary.net} prefix={summary.net > 0 ? '+' : ''} />
          </dd>
        </div>
      </dl>
    </Link>
  );
}

/** Tagihan terlambat + jatuh tempo ≤ 14 hari (maks. 5). */
function BillsCard() {
  const { bills, transactions, billSkips, today } = useData();
  const due = useMemo(() => dueSoon(bills, transactions, billSkips, today, 14), [bills, transactions, billSkips, today]);

  return (
    <section aria-labelledby="bills-card" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h2 className="flex items-center justify-between px-4 pt-4 text-sm font-semibold text-slate-600">
        <span id="bills-card">Tagihan</span>
        <Link to={bills.length > 0 ? '/tagihan' : '/tagihan/baru'} className="font-normal text-brand-700">
          {bills.length > 0 ? 'Lihat semua ›' : 'Tambah ›'}
        </Link>
      </h2>
      {bills.length === 0 ? (
        <p className="p-4 pt-2 text-sm text-slate-500">
          Catat tagihan rutin (listrik, cicilan, kartu kredit) agar diingatkan saat jatuh tempo dan Uang tersedia lebih akurat.
        </p>
      ) : due.length === 0 ? (
        <p className="p-4 pt-2 text-sm text-slate-500">✓ Tidak ada tagihan dalam 14 hari ke depan.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {due.slice(0, 5).map((o) => (
            <li key={`${o.bill.id}-${o.period}`}>
              <BillOccurrenceItem occurrence={o} compact />
            </li>
          ))}
          {due.length > 5 && (
            <li className="px-4 py-2 text-sm text-slate-500">+{due.length - 5} tagihan lainnya</li>
          )}
        </ul>
      )}
    </section>
  );
}

function BudgetCard({ month }: { month: string }) {
  const { transactions, budgetLimits, categoriesById } = useData();
  const top = useMemo(
    () => riskiestBudgets(budgetsForMonth(budgetLimits, expenseByCategory(transactions, month), month)),
    [transactions, budgetLimits, month],
  );

  return (
    <Card>
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>Anggaran</span>
        <Link to="/anggaran" className="font-normal text-brand-700">
          {top.length > 0 ? 'Lihat semua ›' : 'Atur ›'}
        </Link>
      </h2>
      {top.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada anggaran. Tetapkan batas bulanan per kategori agar pengeluaran terpantau.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {top.map(([categoryId, status]) => {
            const category = categoriesById.get(categoryId);
            return (
              <li key={categoryId} className="flex items-center gap-3">
                <CategoryBadge icon={category?.icon ?? '📦'} color={category?.color ?? 'slate'} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{category?.name}</span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                      <Money value={status.spent} /> / <Money value={status.limit!} />
                    </span>
                  </p>
                  <div className="my-1.5">
                    <BudgetMeter status={status} />
                  </div>
                  <BudgetStatusLabel status={status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function AccountsCard() {
  const { totals } = useData();
  return (
    <Link to="/akun" className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50">
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>Akun</span>
        <span className="font-normal text-brand-700">Lihat akun ›</span>
      </h2>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-slate-500">Total kas</dt>
          <dd className="font-semibold">
            <Money value={totals.totalCash} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Total utang</dt>
          <dd className="font-semibold">
            <Money value={totals.totalDebt} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Kekayaan bersih</dt>
          <dd className="font-semibold">
            <Money value={totals.netWorth} />
          </dd>
        </div>
      </dl>
    </Link>
  );
}
