// Anggaran (PRD §9.8). Batas hanya bisa diubah untuk bulan berjalan; bulan lalu hanya dilihat.

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../../app/data';
import { budgetsForMonth, sumBudgets } from '../../domain/budget';
import { expenseByCategory } from '../../domain/report';
import type { Category, ID, Rupiah } from '../../domain/types';
import { db } from '../../db';
import { setBudgetLimit } from '../../db/budgets';
import { toYearMonth } from '../../lib/date';
import { AmountInput } from '../../ui/AmountInput';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { Dialog } from '../../ui/Dialog';
import { MonthNav } from '../../ui/MonthNav';
import { BudgetMeter, BudgetStatusLabel } from '../../ui/charts';
import { Alert, Button, Card, EmptyState, Field, Money, PageHeader, Select } from '../../ui/controls';
import { useToast } from '../../ui/toast';

interface Editing {
  categoryId: ID | null;
  amount: Rupiah | null;
}

export function BudgetsPage() {
  const { transactions, budgetLimits, categories, categoriesById, today } = useData();
  const thisMonth = toYearMonth(today);
  const [month, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editable = month === thisMonth;

  const statuses = useMemo(
    () => budgetsForMonth(budgetLimits, expenseByCategory(transactions, month), month),
    [budgetLimits, transactions, month],
  );
  const rows = [...statuses.entries()]
    .map(([categoryId, status]) => ({ category: categoriesById.get(categoryId)!, status }))
    .filter((r) => r.category)
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder);
  const totals = sumBudgets(statuses);
  const available = categories.filter((c) => c.type === 'expense' && !c.archived && !statuses.has(c.id));

  return (
    <>
      <PageHeader
        title="Anggaran"
        back
        actions={
          editable &&
          available.length > 0 && (
            <Button variant="ghost" onClick={() => setEditing({ categoryId: null, amount: null })}>
              + Atur
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <MonthNav value={month} onChange={setMonth} maxMonth={thisMonth} />
        {!editable && <Alert tone="info">Batas anggaran bulan lalu hanya bisa dilihat, tidak bisa diubah.</Alert>}

        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="🎯" title={editable ? 'Belum ada anggaran' : 'Tidak ada anggaran di bulan ini'}>
              {editable && (
                <>
                  <p className="mb-4">Tetapkan batas bulanan per kategori. Batas berlaku setiap bulan sampai Anda mengubahnya.</p>
                  <Button onClick={() => setEditing({ categoryId: null, amount: null })}>Atur anggaran</Button>
                </>
              )}
            </EmptyState>
          </Card>
        ) : (
          <>
            <Card>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">Total batas</dt>
                  <dd className="font-semibold">
                    <Money value={totals.limit} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Terpakai</dt>
                  <dd className="font-semibold">
                    <Money value={totals.spent} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Sisa</dt>
                  <dd className="font-semibold">
                    <Money value={totals.limit - totals.spent} />
                  </dd>
                </div>
              </dl>
            </Card>

            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {rows.map(({ category, status }) => (
                <li key={category.id} className="flex items-start gap-1 pr-1">
                  <Link
                    to={`/transaksi?bulan=${month}&kategori=${category.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <CategoryBadge icon={category.icon} color={category.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{category.name}</p>
                      <p className="text-sm text-slate-500">
                        <Money value={status.spent} /> dari <Money value={status.limit!} />
                      </p>
                      <div className="my-2">
                        <BudgetMeter status={status} />
                      </div>
                      <BudgetStatusLabel status={status} />
                    </div>
                  </Link>
                  {editable && (
                    <button
                      type="button"
                      aria-label={`Ubah anggaran ${category.name}`}
                      className="mt-2 flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                      onClick={() => setEditing({ categoryId: category.id, amount: status.limit })}
                    >
                      ✎
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="px-1 text-xs text-slate-500">
              Terpakai = pengeluaran kategori bulan ini dikurangi refund. Transfer dan penyesuaian saldo tidak dihitung.
            </p>
          </>
        )}
      </div>

      {editing && (
        <BudgetDialog
          editing={editing}
          month={thisMonth}
          choices={editing.categoryId ? [categoriesById.get(editing.categoryId)!] : available}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function BudgetDialog({
  editing,
  month,
  choices,
  onClose,
}: {
  editing: Editing;
  month: string;
  choices: Category[];
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState<ID>(editing.categoryId ?? choices[0]?.id ?? '');
  const [amount, setAmount] = useState<Rupiah | null>(editing.amount);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const isEdit = editing.categoryId !== null;

  async function save(value: Rupiah) {
    setError(null);
    try {
      await setBudgetLimit(db, { categoryId, month, amount: value });
      toast({ message: value === 0 ? 'Anggaran dihentikan' : 'Anggaran tersimpan' });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan anggaran.');
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? 'Ubah anggaran' : 'Atur anggaran'}
      footer={
        <>
          {isEdit && (
            <Button variant="danger" onClick={() => save(0)}>
              Hentikan
            </Button>
          )}
          <Button
            block
            disabled={!categoryId}
            onClick={() => (amount && amount > 0 ? save(amount) : setError('Masukkan batas lebih dari Rp0.'))}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Kategori">
          <Select value={categoryId} disabled={isEdit} onChange={(e) => setCategoryId(e.target.value)}>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Batas per bulan" error={error ?? undefined}>
          <AmountInput value={amount} onChange={setAmount} size="large" withThousands autoFocus />
        </Field>
        <p className="text-xs text-slate-500">
          Berlaku mulai bulan ini dan bulan-bulan berikutnya. Bulan lalu tetap memakai batas lamanya.
          {isEdit && ' "Hentikan" menghapus anggaran kategori ini mulai bulan ini.'}
        </p>
      </div>
    </Dialog>
  );
}
