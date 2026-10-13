import { Link } from 'react-router';
import { useData } from '../../app/data';
import { daysLate } from '../../domain/billRules';
import type { BillOccurrence } from '../../domain/bills';
import { db } from '../../db';
import { setBillSkipped } from '../../db/bills';
import { formatDisplayDate } from '../../lib/format';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { ButtonLink, Money, cx } from '../../ui/controls';
import { useToast } from '../../ui/toast';
import { ACCOUNT_KIND_ICONS, Check, ICON, Invoice, Minus, Warning } from '../../ui/icons';

const STATUS = {
  overdue: { icon: Warning, label: 'Terlambat', bg: 'var(--color-bad)', ink: '#ffffff' },
  upcoming: { icon: Minus, label: 'Akan datang', bg: '#cbd5e1', ink: '#0f172a' },
  paid: { icon: Check, label: 'Dibayar', bg: 'var(--color-good)', ink: '#ffffff' },
  skipped: { icon: Minus, label: 'Dilewati', bg: 'var(--color-neutral-dot)', ink: '#ffffff' },
} as const;

export function payLink(o: BillOccurrence): string {
  return `/transaksi/baru?tagihan=${o.bill.id}&periode=${o.period}`;
}

/** Satu kejadian tagihan (bulan tertentu) dengan aksi Bayar / Lewati. */
export function BillOccurrenceItem({ occurrence: o, compact }: { occurrence: BillOccurrence; compact?: boolean }) {
  const { accountsById, categoriesById, goals, today } = useData();
  const toast = useToast();
  const category = o.bill.categoryId ? categoriesById.get(o.bill.categoryId) : undefined;
  const target = o.bill.toAccountId ? accountsById.get(o.bill.toAccountId) : undefined;
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
      <CategoryBadge
        icon={category?.icon ?? goals.find((g) => !g.archived && g.accountId === target?.id)?.icon ?? (target ? ACCOUNT_KIND_ICONS[target.kind] : Invoice)}
        color={category?.color ?? 'slate'}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link to={`/tagihan/${o.bill.id}`} className="truncate font-medium hover:underline">
            {o.bill.name}
          </Link>
          <Money
            value={o.payment?.amount ?? o.bill.amount}
            prefix={unpaid && o.bill.isVariable ? '≈ ' : ''}
            className={cx('shrink-0 font-semibold', !unpaid && 'text-slate-500')}
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
              {!compact && payer && ` · ${payer.name}`}
            </p>
          </div>
          {unpaid && compact && (
            <ButtonLink to={payLink(o)} className="min-h-11 shrink-0 px-3">
              Bayar
            </ButtonLink>
          )}
        </div>
        {unpaid && !compact && (
          <div className="mt-2 flex gap-2">
            <ButtonLink to={payLink(o)} className="min-h-11 px-3">
              Bayar
            </ButtonLink>
            {(
              <button
                type="button"
                className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                onClick={() => skip(true)}
              >
                Lewati bulan ini
              </button>
            )}
          </div>
        )}
        {o.status === 'skipped' && !compact && (
          <button
            type="button"
            className="mt-1 min-h-11 text-sm font-semibold text-brand-700"
            onClick={() => skip(false)}
          >
            Batalkan lewati
          </button>
        )}
        {o.status === 'paid' && o.payment && !compact && (
          <Link to={`/transaksi/${o.payment.id}`} className="mt-1 inline-block min-h-11 py-2 text-sm font-semibold text-brand-700">
            Lihat pembayaran
          </Link>
        )}
      </div>
    </div>
  );
}
