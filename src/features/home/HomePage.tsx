// Beranda: Uang tersedia + aksi cepat → yang perlu perhatian → bulan ini → tagihan → target →
// anggaran → akun → transaksi terbaru.

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../../app/data';
import { availableMoney, dueSoon } from '../../domain/bills';
import { budgetsForMonth, riskiestBudgets } from '../../domain/budget';
import { goalProgress, goalSchedule } from '../../domain/goals';
import { sortNewestFirst } from '../../domain/history';
import { expenseByCategory, monthSummary } from '../../domain/report';
import type { Goal } from '../../domain/types';
import { db } from '../../db';
import { setSetting } from '../../db/settings';
import { toYearMonth } from '../../lib/date';
import { formatDisplayDate, formatMonth } from '../../lib/format';
import { formatCompact, formatPercent } from '../../lib/money';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { Dialog } from '../../ui/Dialog';
import { TransactionRow } from '../../ui/TransactionRow';
import { BudgetMeter, BudgetStatusLabel } from '../../ui/charts';
import { BillDueRow } from '../bills/BillOccurrenceItem';
import { ScheduleLabel } from '../goals/GoalCard';
import { Card, EmptyState, Money, SectionHeader, cx, useAmountsHidden } from '../../ui/controls';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowsLeftRight,
  Eye,
  EyeSlash,
  ICON,
  Info,
  Invoice,
  Receipt,
  type Icon,
} from '../../ui/icons';

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function HomePage() {
  const { transactions, today, settings } = useData();
  const hidden = useAmountsHidden();
  const name = settings.userName.trim();
  const month = toYearMonth(today);
  const recent = useMemo(() => sortNewestFirst(transactions).slice(0, 5), [transactions]);

  return (
    <>
      <header className="flex items-center justify-between gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 lg:px-0 lg:pt-6">
        <div>
          <h1 className="sr-only">Beranda</h1>
          <p className="text-sm font-medium text-slate-500">
            {greeting()}
            {name && (
              <>
                , <span className="font-bold text-slate-700">{name}</span>
              </>
            )}{' '}
            <span aria-hidden>👋</span>
          </p>
          <p className="text-[1.375rem] font-extrabold tracking-tight">{formatMonth(month)}</p>
        </div>
        <button
          type="button"
          aria-pressed={hidden}
          aria-label={hidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
          title={hidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
          className="flex size-11 items-center justify-center rounded-[14px] border border-slate-200 bg-surface text-slate-600 pressable"
          onClick={() => setSetting(db, 'hideAmounts', !hidden)}
        >
          {hidden ? <EyeSlash size={ICON.md} /> : <Eye size={ICON.md} />}
        </button>
      </header>

      <div className="flex flex-col gap-7 px-4 pb-4 lg:px-0">
        <div className="flex flex-col gap-4">
          <AvailableCard />
          <QuickActions />
        </div>
        <ThisMonthCard month={month} />
        <BillsCard />
        <GoalsCard />
        <BudgetCard month={month} />
        <AccountsCard />

        <section aria-labelledby="recent">
          <SectionHeader id="recent" title="Transaksi terbaru" to={recent.length > 0 ? '/transaksi' : undefined} linkLabel="Lihat semua" />
          {recent.length === 0 ? (
            <Card>
              <EmptyState icon={Receipt} title="Belum ada transaksi">
                Ketuk + untuk mencatat transaksi pertama Anda.
              </EmptyState>
            </Card>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-surface">
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
  const pending = result.pendingBills.reduce((sum, o) => sum + o.bill.amount, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative overflow-hidden rounded-3xl p-5 text-left shadow-[0_12px_30px_-12px_rgb(8_59_55/0.6)] transition-transform hero-surface active:scale-[0.99]"
      >
        <span aria-hidden className="pointer-events-none absolute -right-12 -bottom-16 size-52 rounded-full border-[28px] border-white/[0.06]" />
        <span className="flex items-center gap-1.5 text-sm font-medium text-white/80">
          Uang tersedia <Info size={ICON.sm} />
        </span>
        <Money
          value={result.available}
          tabular={false}
          className="mt-1 block text-[clamp(2rem,9.5vw,2.75rem)] leading-tight font-extrabold tracking-tight"
        />
        <span className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/75">
          <span className="rounded-2xl bg-white/10 px-3 py-2.5">
            Kas
            <Money value={result.totalCash} className="mt-0.5 block text-sm font-bold text-white" />
          </span>
          <span className="rounded-2xl bg-white/10 px-3 py-2.5">
            Tagihan bulan ini
            <Money
              value={pending}
              prefix={pending > 0 ? '−' : ''}
              className="mt-0.5 block text-sm font-bold text-white"
            />
          </span>
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
          <p className="flex justify-between rounded-2xl bg-brand-50 p-3 text-base font-bold text-brand-900">
            <span>Uang tersedia</span>
            <Money value={result.available} />
          </p>
          <p className="text-xs text-slate-500">
            Akun deposito, emas, tabungan target, dan akun lain yang tidak dicentang &quot;Hitung di Uang tersedia&quot; tidak ikut
            dihitung.
          </p>
        </div>
      </Dialog>
    </>
  );
}

const QUICK: { to: string; label: string; icon: Icon }[] = [
  { to: '/transaksi/baru?jenis=expense', label: 'Keluar', icon: ArrowUpRight },
  { to: '/transaksi/baru?jenis=income', label: 'Masuk', icon: ArrowDownLeft },
  { to: '/transaksi/baru?jenis=transfer', label: 'Transfer', icon: ArrowsLeftRight },
  { to: '/tagihan', label: 'Tagihan', icon: Invoice },
];

function QuickActions() {
  return (
    <nav aria-label="Aksi cepat">
      <ul className="grid grid-cols-4 gap-2">
        {QUICK.map((q) => (
          <li key={q.to}>
            <Link to={q.to} className="group flex flex-col items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="flex size-14 items-center justify-center rounded-[18px] border border-slate-200 bg-surface text-brand-700 transition-colors group-hover:bg-slate-50 group-active:bg-slate-100">
                <q.icon size={ICON.lg} />
              </span>
              {q.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ThisMonthCard({ month }: { month: string }) {
  const { transactions } = useData();
  const summary = useMemo(() => monthSummary(transactions, month), [transactions, month]);
  const max = Math.max(summary.income, summary.expense, 1);
  const rows = [
    { label: 'Pemasukan', value: summary.income, color: 'var(--color-series-income)' },
    { label: 'Pengeluaran', value: summary.expense, color: 'var(--color-series-expense)' },
  ];

  return (
    <section aria-labelledby="this-month">
      <SectionHeader id="this-month" title="Bulan ini" to="/laporan" linkLabel="Laporan" />
      <Card>
        <dl className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(6.5rem,auto)_1fr] items-center gap-x-3">
              <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
              <dd aria-hidden className="row-span-2 h-2.5 overflow-hidden rounded-full bg-progress-track">
                <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
              </dd>
              <dd className="text-[0.9375rem] font-bold">
                <Money value={row.value} />
              </dd>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3">
            <dt className="text-sm text-slate-500">
              Selisih
              {summary.income > 0 && summary.net > 0 && (
                <span className="text-slate-400"> · {formatPercent(summary.net / summary.income)} dari pemasukan</span>
              )}
            </dt>
            <dd className={cx('text-base font-extrabold', summary.net > 0 ? 'text-emerald-700' : summary.net < 0 ? 'text-red-700' : '')}>
              <Money value={summary.net} prefix={summary.net > 0 ? '+' : ''} />
            </dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}

/** Tagihan terlambat + jatuh tempo ≤ 14 hari (maks. 5). */
function BillsCard() {
  const { bills, transactions, billSkips, today } = useData();
  const due = useMemo(() => dueSoon(bills, transactions, billSkips, today, 14), [bills, transactions, billSkips, today]);

  return (
    <section aria-labelledby="bills-card">
      <SectionHeader
        id="bills-card"
        title="Tagihan"
        to={bills.length > 0 ? '/tagihan' : '/tagihan/baru'}
        linkLabel={bills.length > 0 ? 'Lihat semua' : 'Tambah'}
      />
      {bills.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            Catat tagihan rutin (listrik, cicilan, kartu kredit) agar diingatkan saat jatuh tempo dan Uang tersedia lebih akurat.
          </p>
        </Card>
      ) : due.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Tidak ada tagihan dalam 14 hari ke depan.</p>
        </Card>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-surface">
          {due.slice(0, 5).map((o) => (
            <li key={`${o.bill.id}-${o.period}`}>
              <BillDueRow occurrence={o} />
            </li>
          ))}
          {due.length > 5 && <li className="px-4 py-3 text-sm text-slate-500">+{due.length - 5} tagihan lainnya</li>}
        </ul>
      )}
    </section>
  );
}

/** Target aktif dengan tenggat terdekat, digeser menyamping. Tidak tampil jika belum ada target. */
function GoalsCard() {
  const { goals } = useData();
  const active = goals.filter((g) => !g.archived).sort((a, b) => a.targetMonth.localeCompare(b.targetMonth));
  if (active.length === 0) return null;
  return (
    <section aria-labelledby="goals-card">
      <SectionHeader id="goals-card" title="Target tabungan" to="/target" linkLabel="Lihat semua" />
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:scroll-px-0 lg:px-0">
        {active.map((goal) => (
          <li key={goal.id} className="shrink-0 snap-start">
            <GoalTile goal={goal} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const RING: Record<string, string> = {
  done: 'var(--color-good)',
  ahead: 'var(--color-brand-500)',
  on_track: 'var(--color-brand-500)',
  behind: 'var(--color-warn)',
  overdue: 'var(--color-bad)',
};

function GoalTile({ goal }: { goal: Goal }) {
  const { balances, today } = useData();
  const hidden = useAmountsHidden();
  const progress = goalProgress(goal, balances.get(goal.accountId) ?? 0);
  const schedule = goalSchedule(goal, progress.saved, today);
  const pct = Math.min(100, progress.ratio * 100);
  const compact = (v: number) => (hidden ? 'Rp •••' : `Rp${formatCompact(v)}`);

  return (
    <Link to={`/target/${goal.id}`} className="flex w-44 flex-col rounded-[20px] border border-slate-200 bg-surface p-4 pressable">
      <span
        aria-hidden
        className="relative flex size-14 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(${RING[schedule.status]} ${pct}%, var(--color-progress-track) 0)` }}
      >
        <span className="absolute inset-[5px] rounded-full bg-surface" />
        <span className="relative text-2xl">{goal.icon}</span>
      </span>
      <span className="mt-3 truncate text-sm font-bold">{goal.name}</span>
      <span className="text-2xl font-extrabold tracking-tight">{formatPercent(progress.ratio)}</span>
      <span className="truncate text-xs text-slate-500">
        {compact(progress.saved)} dari {compact(goal.targetAmount)}
      </span>
      <ScheduleLabel schedule={schedule} short className="mt-2" />
    </Link>
  );
}

function BudgetCard({ month }: { month: string }) {
  const { transactions, budgetLimits, categoriesById } = useData();
  const top = useMemo(
    () => riskiestBudgets(budgetsForMonth(budgetLimits, expenseByCategory(transactions, month), month)),
    [transactions, budgetLimits, month],
  );

  return (
    <section aria-labelledby="budget-card">
      <SectionHeader id="budget-card" title="Anggaran" to="/anggaran" linkLabel={top.length > 0 ? 'Lihat semua' : 'Atur'} />
      <Card>
        {top.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada anggaran. Tetapkan batas bulanan per kategori agar pengeluaran terpantau.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {top.map(([categoryId, status]) => {
              const category = categoriesById.get(categoryId);
              return (
                <li key={categoryId} className="flex items-center gap-3">
                  <CategoryBadge icon={category?.icon ?? '📦'} color={category?.color ?? 'slate'} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                      <span className="min-w-0 font-semibold">{category?.name}</span>
                      <span className="shrink-0 text-xs whitespace-nowrap text-slate-500">
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
    </section>
  );
}

function AccountsCard() {
  const { totals } = useData();
  return (
    <section aria-labelledby="accounts-card">
      <SectionHeader id="accounts-card" title="Akun" to="/akun" linkLabel="Lihat akun" />
      <Card>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-x-3 gap-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Total kas</dt>
            <dd className="font-bold">
              <Money value={totals.totalCash} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Total utang</dt>
            <dd className="font-bold">
              <Money value={totals.totalDebt} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Kekayaan bersih</dt>
            <dd className="font-bold">
              <Money value={totals.netWorth} />
            </dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}
