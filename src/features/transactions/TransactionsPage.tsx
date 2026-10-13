import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useData } from '../../app/data';
import {
  activeFilterCount,
  filterTransactions,
  groupByDate,
  monthsWithTransactions,
  sortNewestFirst,
  type HistoryFilter,
} from '../../domain/history';
import type { TransactionType } from '../../domain/types';
import { addDays } from '../../lib/date';
import { formatDisplayDate, formatMonth } from '../../lib/format';
import { Dialog } from '../../ui/Dialog';
import { TransactionRow } from '../../ui/TransactionRow';
import { Button, ButtonLink, EmptyState, Field, Money, PageHeader, Select, TextInput } from '../../ui/controls';

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  transfer: 'Transfer',
  adjustment: 'Penyesuaian',
};

const PAGE_SIZE = 100;

/** Filter disimpan di URL agar tetap ada saat kembali dari detail transaksi. */
function useHistoryFilter(): [HistoryFilter, (next: HistoryFilter) => void] {
  const [params, setParams] = useSearchParams();
  const filter: HistoryFilter = {
    query: params.get('q') ?? undefined,
    month: params.get('bulan') ?? undefined,
    type: (params.get('jenis') as TransactionType | null) ?? undefined,
    accountId: params.get('akun') ?? undefined,
    categoryId: params.get('kategori') ?? undefined,
  };
  const set = (next: HistoryFilter) => {
    const entries = Object.entries({
      q: next.query,
      bulan: next.month,
      jenis: next.type,
      akun: next.accountId,
      kategori: next.categoryId,
    }).filter((e): e is [string, string] => !!e[1]);
    setParams(new URLSearchParams(entries), { replace: true });
  };
  return [filter, set];
}

export function TransactionsPage() {
  const { transactions, accountsById, categoriesById, today } = useData();
  const [filter, setFilter] = useHistoryFilter();
  const [filterOpen, setFilterOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () => sortNewestFirst(filterTransactions(transactions, filter, accountsById, categoriesById)),
    // Filter dibandingkan per nilai agar tidak menghitung ulang setiap render.
    [transactions, accountsById, categoriesById, filter.query, filter.month, filter.type, filter.accountId, filter.categoryId], // eslint-disable-line
  );
  const groups = useMemo(() => groupByDate(filtered.slice(0, visible)), [filtered, visible]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible((v) => v + PAGE_SIZE);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [groups.length]);

  const chips = [
    filter.month && { key: 'month', label: formatMonth(filter.month) },
    filter.type && { key: 'type', label: TYPE_LABEL[filter.type] },
    filter.accountId && { key: 'accountId', label: accountsById.get(filter.accountId)?.name ?? 'Akun' },
    filter.categoryId && { key: 'categoryId', label: categoriesById.get(filter.categoryId)?.name ?? 'Kategori' },
  ].filter(Boolean) as { key: keyof HistoryFilter; label: string }[];
  const hasFilter = activeFilterCount(filter) > 0 || !!filter.query;

  const dayLabel = (date: string) =>
    date === today ? 'Hari ini' : date === addDays(today, -1) ? 'Kemarin' : formatDisplayDate(date);

  return (
    <>
      <PageHeader title="Transaksi" />
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex gap-2">
          <TextInput
            type="search"
            aria-label="Cari transaksi"
            placeholder="Cari catatan, kategori, akun…"
            value={filter.query ?? ''}
            onChange={(e) => setFilter({ ...filter, query: e.target.value || undefined })}
          />
          <Button variant="secondary" onClick={() => setFilterOpen(true)} aria-label="Filter transaksi">
            Filter{activeFilterCount(filter) > 0 ? ` (${activeFilterCount(filter)})` : ''}
          </Button>
        </div>
        {(chips.length > 0 || hasFilter) && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                aria-label={`Hapus filter ${chip.label}`}
                onClick={() => setFilter({ ...filter, [chip.key]: undefined })}
                className="flex min-h-9 items-center gap-1 rounded-full bg-brand-100 px-3 text-sm font-medium text-brand-900"
              >
                {chip.label} <span aria-hidden>✕</span>
              </button>
            ))}
            <span className="text-sm text-slate-500">{filtered.length} transaksi</span>
            <button type="button" className="min-h-9 px-2 text-sm font-semibold text-brand-700" onClick={() => setFilter({})}>
              Reset filter
            </button>
          </div>
        )}
      </div>

      {transactions.length === 0 ? (
        <EmptyState icon="📝" title="Belum ada transaksi">
          <p className="mb-4">Ketuk + untuk mencatat transaksi pertama Anda.</p>
          <ButtonLink to="/transaksi/baru">Tambah transaksi</ButtonLink>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Tidak ada transaksi yang cocok">
          Coba ubah kata kunci atau filter.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3 pb-4">
          {groups.map((group) => (
            <section key={group.date} aria-label={dayLabel(group.date)} className="bg-white sm:mx-4 sm:rounded-2xl sm:border sm:border-slate-200">
              <h2 className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm">
                <span className="font-semibold text-slate-700">{dayLabel(group.date)}</span>
                {group.expenseTotal !== 0 && (
                  <span className="text-slate-500">
                    Pengeluaran <Money value={group.expenseTotal} />
                  </span>
                )}
              </h2>
              <ul className="divide-y divide-slate-100">
                {group.transactions.map((tx) => (
                  <li key={tx.id}>
                    <TransactionRow tx={tx} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {visible < filtered.length && <div ref={sentinel} className="h-10" aria-hidden />}
        </div>
      )}

      <FilterDialog open={filterOpen} onClose={() => setFilterOpen(false)} filter={filter} onApply={setFilter} />
    </>
  );
}

function FilterDialog({
  open,
  onClose,
  filter,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filter: HistoryFilter;
  onApply: (filter: HistoryFilter) => void;
}) {
  const { transactions, accounts, categories } = useData();
  const months = useMemo(() => monthsWithTransactions(transactions), [transactions]);
  const set = (patch: Partial<HistoryFilter>) => onApply({ ...filter, ...patch });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Filter transaksi"
      footer={
        <>
          <Button variant="secondary" block onClick={() => onApply({ query: filter.query })}>
            Reset
          </Button>
          <Button block onClick={onClose}>
            Selesai
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Bulan">
          <Select value={filter.month ?? ''} onChange={(e) => set({ month: e.target.value || undefined })}>
            <option value="">Semua bulan</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jenis">
          <Select value={filter.type ?? ''} onChange={(e) => set({ type: (e.target.value as TransactionType) || undefined })}>
            <option value="">Semua jenis</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Akun">
          <Select value={filter.accountId ?? ''} onChange={(e) => set({ accountId: e.target.value || undefined })}>
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? ' (arsip)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kategori">
          <Select value={filter.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || undefined })}>
            <option value="">Semua kategori</option>
            <optgroup label="Pengeluaran">
              {categories
                .filter((c) => c.type === 'expense')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Pemasukan">
              {categories
                .filter((c) => c.type === 'income')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
            </optgroup>
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
