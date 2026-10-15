import { Link } from 'react-router';
import { useData } from '../../app/data';
import { daysLate } from '../../domain/billRules';
import type { BillOccurrence } from '../../domain/bills';
import { db } from '../../db';
import { setBillSkipped } from '../../db/bills';
import { formatDayMonth, formatDisplayDate } from '../../lib/format';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { ButtonLink, Money, cx } from '../../ui/controls';
import { useToast } from '../../ui/toast';
import { ACCOUNT_KIND_ICONS, Check, ICON, Invoice, Minus, Warning, WarningCircle } from '../../ui/icons';

const STATUS = {
  overdue: { icon: Warning, label: 'Terlambat', bg: 'var(--color-bad)', ink: 'var(--color-on-status)' },
  upcoming: { icon: Minus, label: 'Akan datang', bg: 'var(--color-slate-300)', ink: 'var(--color-slate-900)' },
  paid: { icon: Check, label: 'Dibayar', bg: 'var(--color-good)', ink: 'var(--color-on-status)' },
  skipped: { icon: Minus, label: 'Dilewati', bg: 'var(--color-neutral-dot)', ink: 'var(--color-on-status)' },
} as const;

export function payLink(o: BillOccurrence): string {
  return `/transaksi/baru?tagihan=${o.bill.id}&periode=${o.period}`;
}

function useBillIcon(o: BillOccurrence) {
  const { accountsById, categoriesById, goals } = useData();
  const category = o.bill.categoryId ? categoriesById.get(o.bill.categoryId) : undefined;
  const target = o.bill.toAccountId ? accountsById.get(o.bill.toAccountId) : undefined;
  return {
    icon: category?.icon ?? goals.find((g) => !g.archived && g.accountId === target?.id)?.icon ?? (target ? ACCOUNT_KIND_ICONS[target.kind] : Invoice),
    color: category?.color ?? 'slate',
  };
}

function dueText(dueDate: string, today: string): string {
  const days = Math.round((Date.parse(dueDate) - Date.parse(today)) / 86_400_000);
  const when = days === 0 ? 'hari ini' : days === 1 ? 'besok' : `${days} hari lagi`;
  return `${formatDayMonth(dueDate)} · ${when}`;
}

/** Baris ringkas di Beranda: nama, jatuh tempo, nominal, dan tombol Bayar kecil. */
export function BillDueRow({ occurrence: o }: { occurrence: BillOccurrence }) {
  const { today } = useData();
  const badge = useBillIcon(o);
  const overdue = o.status === 'overdue';

  return (
    <div className={cx('flex items-center gap-3 px-4 py-3', overdue && 'bg-red-50')}>
      <CategoryBadge icon={badge.icon} color={badge.color} />
      <div className="min-w-0 flex-1">
        <Link to={`/tagihan/${o.bill.id}`} className="block truncate text-sm font-semibold hover:underline">
          {o.bill.name}
        </Link>
        {overdue ? (
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
            <WarningCircle size={ICON.sm} weight="fill" /> Terlambat {daysLate(o, today)} hari
          </p>
        ) : (
          <p className="text-xs text-slate-500">{dueText(o.dueDate, today)}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Money value={o.bill.amount} prefix={o.bill.isVariable ? '≈ ' : ''} className="text-sm font-bold" />
        <Link
          to={payLink(o)}
          className={cx(
            "relative inline-flex h-8 items-center rounded-full px-3.5 text-xs font-bold after:absolute after:-inset-x-1 after:-inset-y-1.5 after:content-['']",
            overdue ? 'bg-bad text-on-status' : 'bg-brand-50 text-brand-800 hover:bg-brand-100',
          )}
        >
          Bayar
        </Link>
      </div>
    </div>
  );
}

/** Satu kejadian tagihan (bulan tertentu) dengan aksi Bayar / Lewati. */
export function BillOccurrenceItem({ occurrence: o }: { occurrence: BillOccurrence }) {
  const { accountsById, today } = useData();
  const toast = useToast();
  const badge = useBillIcon(o);
  const payer = accountsById.get(o.bill.accountId);
  const status = STATUS[o.status];
  const unpaid = o.status === 'overdue' || o.status === 'upcoming';
  const late = o.status === 'overdue' ? daysLate(o, today) : 0;

  async function skip(skipped: boolean) {
    await setBillSkipped(db, { billId: o.bill.id, period: o.period, skipped });
    if (skipped) {
      toast({
        message: `${o.bill.name} dilewati bulan ini`,
        actionLabel: 'Batalkan',
        onAction: () => setBillSkipped(db, { billId: o.bill.id, period: o.period, skipped: false }),
      });
    }
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <CategoryBadge icon={badge.icon} color={badge.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link to={`/tagihan/${o.bill.id}`} className="truncate font-semibold hover:underline">
            {o.bill.name}
          </Link>
          <Money
            value={o.payment?.amount ?? o.bill.amount}
            prefix={unpaid && o.bill.isVariable ? '≈ ' : ''}
            className={cx('shrink-0 font-bold', !unpaid && 'text-slate-500')}
          />
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 text-sm">
            <p className="mt-0.5 inline-flex items-center gap-1 text-slate-700">
              <span
                aria-hidden
                className="flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ background: status.bg, color: status.ink }}
              >
                <status.icon size={ICON.xs} weight="bold" />
              </span>
              {o.status === 'overdue' ? `Terlambat ${late} hari` : status.label}
            </p>
            <p className="text-slate-500">
              Jatuh tempo {formatDisplayDate(o.dueDate)}
              {payer && ` · ${payer.name}`}
            </p>
          </div>
        </div>
        {unpaid && (
          <div className="mt-2 flex gap-2">
            <ButtonLink to={payLink(o)} className="min-h-11 px-3">
              Bayar
            </ButtonLink>
            <button
              type="button"
              className="min-h-11 rounded-[14px] px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              onClick={() => skip(true)}
            >
              Lewati bulan ini
            </button>
          </div>
        )}
        {o.status === 'skipped' && (
          <button
            type="button"
            className="mt-1 min-h-11 text-sm font-semibold text-brand-700"
            onClick={() => skip(false)}
          >
            Batalkan lewati
          </button>
        )}
        {o.status === 'paid' && o.payment && (
          <Link to={`/transaksi/${o.payment.id}`} className="mt-1 inline-block min-h-11 py-2 text-sm font-semibold text-brand-700">
            Lihat pembayaran
          </Link>
        )}
      </div>
    </div>
  );
}
