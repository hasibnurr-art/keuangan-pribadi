// Detail target: progres, kebutuhan per bulan, status jadwal, proyeksi, simulasi, setoran rutin.

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useData } from '../../app/data';
import {
  MILESTONE_MESSAGE,
  averageMonthlyGrowth,
  completionMonth,
  goalProgress,
  goalSchedule,
  monthsLeft,
  reachedMilestone,
  requiredPerMonth,
} from '../../domain/goals';
import { sortNewestFirst } from '../../domain/history';
import type { Rupiah, YearMonth } from '../../domain/types';
import { db } from '../../db';
import { deleteGoal, setGoalArchived } from '../../db/goals';
import { addMonths, monthsBetween, toYearMonth } from '../../lib/date';
import { formatMonth } from '../../lib/format';
import { formatPercent } from '../../lib/money';
import { AmountInput } from '../../ui/AmountInput';
import { ConfirmDialog } from '../../ui/Dialog';
import { TransactionRow } from '../../ui/TransactionRow';
import { Alert, Button, ButtonLink, Card, Field, Money, PageHeader, Segmented, TextInput } from '../../ui/controls';
import { useToast } from '../../ui/toast';
import { GoalProgressBar, ScheduleLabel } from './GoalCard';

function monthDiffText(a: YearMonth, b: YearMonth): string {
  const diff = a > b ? monthsBetween(b, a).length - 1 : -(monthsBetween(a, b).length - 1);
  if (diff === 0) return 'tepat waktu';
  return diff > 0 ? `${diff} bulan lebih lambat dari target` : `${-diff} bulan lebih cepat dari target`;
}

export function GoalDetailPage() {
  const { id = '' } = useParams();
  const { goals, accountsById, balances, transactions, bills, today } = useData();
  const goal = goals.find((g) => g.id === id);
  const navigate = useNavigate();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = goal ? accountsById.get(goal.accountId) : undefined;
  const related = useMemo(
    () => (goal ? sortNewestFirst(transactions.filter((t) => t.accountId === goal.accountId || t.toAccountId === goal.accountId)).slice(0, 10) : []),
    [transactions, goal],
  );

  if (!goal || !account) {
    return (
      <>
        <PageHeader title="Target" back="/target" />
        <div className="p-4">
          <Alert tone="info">Target tidak ditemukan.</Alert>
        </div>
      </>
    );
  }

  const progress = goalProgress(goal, balances.get(goal.accountId) ?? 0);
  const schedule = goalSchedule(goal, progress.saved, today);
  const needed = requiredPerMonth(progress.remaining, goal.targetMonth, today);
  const average = averageMonthlyGrowth(account, transactions, today);
  const projected = average !== null ? completionMonth(progress.remaining, average, today) : null;
  const milestone = reachedMilestone(progress.ratio);
  const depositBill = bills.find((b) => b.active && b.toAccountId === goal.accountId);
  const left = monthsLeft(goal.targetMonth, today);

  async function toggleArchive() {
    setError(null);
    try {
      await setGoalArchived(db, goal!.id, !goal!.archived);
      toast({ message: goal!.archived ? 'Target diaktifkan kembali' : 'Target diarsipkan' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah target.');
    }
  }

  async function remove() {
    setDeleteOpen(false);
    await deleteGoal(db, goal!.id);
    toast({ message: 'Target dihapus. Akun tabungan dan transaksinya tetap ada.' });
    navigate('/target', { replace: true });
  }

  return (
    <>
      <PageHeader title={goal.name} back="/target" actions={<ButtonLink to={`/target/${goal.id}/ubah`} variant="ghost">Ubah</ButtonLink>} />
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-2xl">
              {goal.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Terkumpul · {formatPercent(progress.ratio)}</p>
              <p className="text-2xl font-bold">
                <Money value={progress.saved} tabular={false} />
              </p>
              <p className="text-sm text-slate-500">
                dari <Money value={goal.targetAmount} /> · target {formatMonth(goal.targetMonth)}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <GoalProgressBar ratio={progress.ratio} status={schedule.status} />
          </div>
          <ScheduleLabel schedule={schedule} className="mt-2 text-sm" />
          {milestone && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{MILESTONE_MESSAGE[milestone]}</p>}
        </Card>

        {!progress.done && (
          <Card>
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-x-3 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Kekurangan</dt>
                <dd className="font-semibold">
                  <Money value={progress.remaining} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{left > 0 ? 'Perlu per bulan' : 'Perlu segera'}</dt>
                <dd className="font-semibold">
                  <Money value={needed} />
                  {left > 0 && <span className="block text-xs font-normal text-slate-500">selama {left} bulan</span>}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Rata-rata 3 bulan</dt>
                <dd className="font-semibold">{average === null ? 'Belum ada data' : <Money value={average} />}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Dengan laju ini</dt>
                <dd className="font-semibold">
                  {average === null ? '—' : projected ? formatMonth(projected) : 'Belum bertambah'}
                </dd>
              </div>
            </dl>
            {projected && (
              <p className="mt-2 text-xs text-slate-500">Perkiraan tercapai {monthDiffText(projected, goal.targetMonth)}.</p>
            )}
          </Card>
        )}

        <Card>
          <h2 className="font-semibold">Setoran</h2>
          {depositBill ? (
            <p className="mt-1 text-sm text-slate-600">
              Setoran rutin <Money value={depositBill.amount} /> tiap tanggal {depositBill.dueDay} dari{' '}
              {accountsById.get(depositBill.accountId)?.name}.{' '}
              <Link to={`/tagihan/${depositBill.id}`} className="font-semibold text-brand-700">
                Ubah
              </Link>
              {depositBill.amount < needed && !progress.done && (
                <span className="mt-1 block text-amber-800">
                  Setoran ini lebih kecil dari kebutuhan <Money value={needed} />/bulan.
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              Belum ada setoran rutin. Jadwalkan setelah gajian agar uangnya disisihkan lebih dulu.
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ButtonLink to={`/transaksi/baru?jenis=transfer&ke=${goal.accountId}`}>Tambah setoran</ButtonLink>
            {!depositBill && (
              <ButtonLink to={`/tagihan/baru?ke=${goal.accountId}&nominal=${needed}`} variant="secondary">
                Setoran rutin
              </ButtonLink>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Akun tabungan: <Link to={`/akun/${account.id}`} className="font-medium text-brand-700">{account.name}</Link> · tidak
            dihitung di Uang tersedia.
          </p>
        </Card>

        {!progress.done && <Simulator remaining={progress.remaining} targetMonth={goal.targetMonth} today={today} />}

        {related.length > 0 && (
          <section aria-labelledby="goal-tx">
            <h2 id="goal-tx" className="mb-2 px-1 text-sm font-semibold text-slate-600">
              Riwayat terakhir
            </h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {related.map((tx) => (
                <li key={tx.id}>
                  <TransactionRow tx={tx} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={toggleArchive}>
            {goal.archived ? 'Aktifkan lagi' : progress.done ? 'Tandai selesai' : 'Arsipkan'}
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Hapus target
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Hapus target?"
        message={`Target ${goal.name} akan dihapus. Akun ${account.name}, saldonya, dan transaksinya TIDAK ikut terhapus.`}
        confirmLabel="Hapus"
        danger
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

/** Simulasi "bagaimana kalau": nominal per bulan → kapan tercapai, atau bulan → perlu berapa. */
function Simulator({ remaining, targetMonth, today }: { remaining: Rupiah; targetMonth: YearMonth; today: string }) {
  const [mode, setMode] = useState<'amount' | 'month'>('amount');
  const [amount, setAmount] = useState<Rupiah | null>(null);
  const [month, setMonth] = useState(addMonths(targetMonth, -6) > toYearMonth(today) ? addMonths(targetMonth, -6) : targetMonth);
  const result = amount ? completionMonth(remaining, amount, today) : null;
  const perMonth = month >= toYearMonth(today) ? requiredPerMonth(remaining, month, today) : null;

  return (
    <Card>
      <h2 className="mb-3 font-semibold">Simulasi</h2>
      <Segmented
        label="Jenis simulasi"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'amount', label: 'Nabung per bulan' },
          { value: 'month', label: 'Tercapai bulan' },
        ]}
      />
      <div className="mt-3">
        {mode === 'amount' ? (
          <>
            <Field label="Kalau saya menabung per bulan">
              <AmountInput value={amount} onChange={setAmount} withThousands />
            </Field>
            <p className="mt-2 text-sm" aria-live="polite">
              {result ? (
                <>
                  Tercapai <strong>{formatMonth(result)}</strong> — {monthDiffText(result, targetMonth)}.
                </>
              ) : (
                <span className="text-slate-500">Masukkan nominal untuk melihat perkiraan.</span>
              )}
            </p>
          </>
        ) : (
          <>
            <Field label="Kalau saya ingin tercapai pada">
              <TextInput type="month" value={month} min={toYearMonth(today)} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <p className="mt-2 text-sm" aria-live="polite">
              {perMonth !== null ? (
                <>
                  Perlu menabung <strong><Money value={perMonth} /></strong> per bulan.
                </>
              ) : (
                <span className="text-slate-500">Pilih bulan ini atau setelahnya.</span>
              )}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
