import { useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../../app/data';
import { ACCOUNT_KIND_LABEL } from '../../domain/defaults';
import type { Account, AccountGroup } from '../../domain/types';
import { ButtonLink, Card, EmptyState, Money, PageHeader } from '../../ui/controls';
import { AccountKindBadge, CreditCard, ICON, Plus, Wallet } from '../../ui/icons';

export function AccountsPage() {
  const { accounts, totals } = useData();
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = accounts.filter((a) => a.archived).length;

  return (
    <>
      <PageHeader title="Akun" actions={<ButtonLink to="/akun/baru" variant="ghost"><Plus size={ICON.sm} weight="bold" /> Tambah</ButtonLink>} />
      <div className="flex flex-col gap-4 p-4">
        <NetWorthCard totals={totals} />
        <AccountGroupList group="asset" title="Aset / kas" showArchived={showArchived} />
        <AccountGroupList group="liability" title="Utang" showArchived={showArchived} />
        {archivedCount > 0 && (
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-brand-700"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Sembunyikan akun terarsip' : `Tampilkan ${archivedCount} akun terarsip`}
          </button>
        )}
      </div>
    </>
  );
}

export function NetWorthCard({ totals }: { totals: ReturnType<typeof useData>['totals'] }) {
  return (
    <Card>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Total kas</dt>
          <dd className="text-base font-semibold">
            <Money value={totals.totalCash} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Total utang</dt>
          <dd className="text-base font-semibold">
            <Money value={totals.totalDebt} />
          </dd>
        </div>
        <div className="col-span-2 border-t border-slate-100 pt-3">
          <dt className="text-slate-500">Kekayaan bersih (semua aset − utang)</dt>
          <dd className="text-xl font-bold text-brand-900">
            <Money value={totals.netWorth} />
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function AccountGroupList({ group, title, showArchived }: { group: AccountGroup; title: string; showArchived: boolean }) {
  const { accounts, balances } = useData();
  const list = accounts.filter((a) => a.group === group && (showArchived || !a.archived));
  const subtotal = list.filter((a) => !a.archived).reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);

  return (
    <section aria-labelledby={`group-${group}`}>
      <h2 id={`group-${group}`} className="mb-2 flex items-center justify-between px-1 text-base font-bold tracking-tight">
        <span>{title}</span>
        {list.length > 0 && <Money value={subtotal} />}
      </h2>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={group === 'asset' ? Wallet : CreditCard} title={group === 'asset' ? 'Belum ada akun aset' : 'Belum ada akun utang'}>
            {group === 'liability' && 'Tambahkan kartu kredit, PayLater, atau pinjaman agar utang ikut tercatat.'}
          </EmptyState>
        </Card>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-surface">
          {list.map((account) => (
            <li key={account.id}>
              <AccountRow account={account} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AccountRow({ account }: { account: Account }) {
  const { balances } = useData();
  const balance = balances.get(account.id) ?? 0;
  return (
    <Link to={`/akun/${account.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 pressable">
      <AccountKindBadge kind={account.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {account.name}
          {account.archived && <span className="ml-2 text-xs font-normal text-slate-500">(arsip)</span>}
        </p>
        <p className="truncate text-sm text-slate-500">{ACCOUNT_KIND_LABEL[account.kind]}</p>
      </div>
      <div className="text-right">
        <Money value={balance} className="font-semibold" />
        {account.group === 'liability' && <p className="text-xs text-slate-500">terutang</p>}
      </div>
    </Link>
  );
}
