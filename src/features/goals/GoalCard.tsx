import { Link } from 'react-router';
import { useData } from '../../app/data';
import { goalProgress, goalSchedule, type Schedule } from '../../domain/goals';
import type { Goal } from '../../domain/types';
import { formatMonth } from '../../lib/format';
import { formatPercent } from '../../lib/money';
import { Money, cx } from '../../ui/controls';
import { Check, ICON, TrendUp, Warning } from '../../ui/icons';

// Palet status (sama dengan anggaran): selalu disertai ikon + teks.
const STATUS = {
  done: { icon: Check, bg: 'var(--color-good)', ink: 'var(--color-on-status)', fill: 'var(--color-good)' },
  ahead: { icon: TrendUp, bg: 'var(--color-good)', ink: 'var(--color-on-status)', fill: 'var(--color-series-income)' },
  on_track: { icon: Check, bg: 'var(--color-good)', ink: 'var(--color-on-status)', fill: 'var(--color-series-income)' },
  behind: { icon: Warning, bg: 'var(--color-warn)', ink: '#0a1112', fill: 'var(--color-series-income)' },
  overdue: { icon: Warning, bg: 'var(--color-bad)', ink: 'var(--color-on-status)', fill: 'var(--color-series-income)' },
} as const;

/** `short`: tanpa nominal selisih (untuk kartu sempit). */
export function ScheduleLabel({ schedule, className, short }: { schedule: Schedule; className?: string; short?: boolean }) {
  const style = STATUS[schedule.status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs text-slate-700', className)}>
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: style.bg, color: style.ink }}
      >
        <style.icon size={ICON.xs} weight="bold" />
      </span>
      {schedule.status === 'done' && 'Target tercapai'}
      {schedule.status === 'on_track' && 'Sesuai jadwal'}
      {schedule.status === 'ahead' && short && 'Lebih cepat dari jadwal'}
      {schedule.status === 'behind' && short && 'Tertinggal dari jadwal'}
      {schedule.status === 'ahead' && !short && (
        <>
          Lebih cepat <Money value={schedule.difference} /> dari jadwal
        </>
      )}
      {schedule.status === 'behind' && !short && (
        <>
          Tertinggal <Money value={-schedule.difference} /> dari jadwal
        </>
      )}
      {schedule.status === 'overdue' && 'Lewat tenggat'}
    </span>
  );
}

export function GoalProgressBar({ ratio, status }: { ratio: number; status: Schedule['status'] }) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={`${formatPercent(ratio)} terkumpul`}
      className="h-2.5 overflow-hidden rounded-full bg-progress-track"
    >
      <div className="h-2.5 rounded-full" style={{ width: `${ratio * 100}%`, background: STATUS[status].fill }} />
    </div>
  );
}

/** Kartu ringkas target (daftar & Beranda). */
export function GoalCard({ goal }: { goal: Goal }) {
  const { balances, today } = useData();
  const progress = goalProgress(goal, balances.get(goal.accountId) ?? 0);
  const schedule = goalSchedule(goal, progress.saved, today);

  return (
    <Link to={`/target/${goal.id}`} className="block px-4 py-3 pressable">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-brand-50 text-xl">
          {goal.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{goal.name}</span>
            <span className="shrink-0 text-sm font-semibold">{formatPercent(progress.ratio)}</span>
          </p>
          <p className="truncate text-xs text-slate-500">
            <Money value={progress.saved} /> dari <Money value={goal.targetAmount} /> · {formatMonth(goal.targetMonth)}
          </p>
        </div>
      </div>
      <div className="mt-2">
        <GoalProgressBar ratio={progress.ratio} status={schedule.status} />
      </div>
      <ScheduleLabel schedule={schedule} className="mt-1.5" />
    </Link>
  );
}
