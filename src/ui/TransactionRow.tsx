import { Link } from 'react-router';
import { useData } from '../app/data';
import type { Transaction } from '../domain/types';
import { CategoryBadge } from './CategoryBadge';
import { Money, cx } from './controls';

/** Baris transaksi. Biaya transfer membuka transfer induknya. */
export function TransactionRow({ tx }: { tx: Transaction }) {
  const { accountsById, categoriesById } = useData();
  const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
  const account = accountsById.get(tx.accountId);
  const target = tx.groupId ?? tx.id;

  let title: string;
  let subtitle = account?.name ?? '?';
  let icon = category?.icon ?? '📦';
  let color = category?.color ?? 'slate';
  let amount;

  switch (tx.type) {
    case 'transfer':
      title = 'Transfer';
      icon = '⇄';
      color = 'slate';
      subtitle = `${account?.name ?? '?'} → ${tx.toAccountId ? accountsById.get(tx.toAccountId)?.name ?? '?' : '?'}`;
      amount = <Money value={tx.amount} className="text-slate-500" />;
      break;
    case 'adjustment':
      title = 'Penyesuaian saldo';
      icon = '⚖️';
      color = 'slate';
      amount = (
        <Money value={tx.amount} prefix={tx.adjustDirection === 'decrease' ? '−' : '+'} className="text-slate-500" />
      );
      break;
    case 'income':
      title = category?.name ?? 'Pemasukan';
      amount = <Money value={tx.amount} prefix="+" className="font-semibold text-emerald-700" />;
      break;
    default:
      title = category?.name ?? 'Pengeluaran';
      amount = <Money value={tx.amount} className="font-semibold text-slate-900" />;
  }

  return (
    <Link
      to={`/transaksi/${target}`}
      className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-slate-50 focus-visible:bg-slate-50"
    >
      <CategoryBadge icon={icon} color={color} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-medium">
          <span className="truncate">{title}</span>
          {tx.isRefund && (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">Refund</span>
          )}
        </p>
        <p className={cx('truncate text-sm text-slate-500')}>
          {subtitle}
          {tx.note ? ` · ${tx.note}` : ''}
        </p>
      </div>
      {amount}
    </Link>
  );
}
