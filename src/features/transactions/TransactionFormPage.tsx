import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useData } from '../../app/data';
import { sortCategoriesByUsage } from '../../domain/history';
import type { Category, ID, Rupiah, Transaction, TransactionType } from '../../domain/types';
import type { FieldErrors, TransactionDraft } from '../../domain/validation';
import { db } from '../../db';
import { setSetting } from '../../db/settings';
import {
  ValidationError,
  deleteTransaction,
  feeIdFor,
  getTransactionGroup,
  restoreTransactions,
  saveTransaction,
  undoSave,
} from '../../db/transactions';
import { addDays } from '../../lib/date';
import { formatDisplayDate, formatMonth } from '../../lib/format';
import { AccountSelect } from '../../ui/AccountSelect';
import { AmountInput } from '../../ui/AmountInput';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { Alert, Button, Field, Money, PageHeader, Segmented, Select, TextInput, cx, goBack } from '../../ui/controls';
import { useToast } from '../../ui/toast';
import { ICON, Minus, Plus } from '../../ui/icons';

type EditableType = Exclude<TransactionType, 'adjustment'>;

const TYPE_OPTIONS: { value: EditableType; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

export function TransactionFormPage() {
  const { id } = useParams();
  // undefined = memuat; null = tidak ditemukan.
  const group = useLiveQuery(async () => (id ? getTransactionGroup(db, id) : []), [id]);

  if (group === undefined) return null;
  if (!id) return <TransactionForm key="new" existing={null} />;

  const main = group.find((t) => t.id === id);
  if (!main) return <NotFound />;
  // Biaya transfer diedit lewat transfer induknya.
  if (main.groupId && main.groupId !== main.id) return <Navigate to={`/transaksi/${main.groupId}`} replace />;
  if (main.type === 'adjustment') return <AdjustmentDetail tx={main} />;
  return <TransactionForm key={id} existing={{ main, fee: group.find((t) => t.id === feeIdFor(main.id)) ?? null, group }} />;
}

function NotFound() {
  return (
    <>
      <PageHeader title="Transaksi" back />
      <div className="p-4">
        <Alert tone="info">Transaksi tidak ditemukan. Mungkin sudah dihapus.</Alert>
      </div>
    </>
  );
}

interface Existing {
  main: Transaction;
  fee: Transaction | null;
  group: Transaction[];
}

function TransactionForm({ existing }: { existing: Existing | null }) {
  const data = useData();
  const { accounts, categories, transactions, settings, today, accountsById } = data;
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const isNew = existing === null;
  const main = existing?.main;

  // Pembayaran tagihan: dari tombol "Bayar" (?tagihan=&periode=) atau saat mengubah pembayaran lama.
  const billRef = main?.billId
    ? { id: main.billId, period: main.billPeriod ?? '' }
    : isNew && params.get('tagihan') && params.get('periode')
      ? { id: params.get('tagihan')!, period: params.get('periode')! }
      : null;
  const bill = billRef ? data.bills.find((b) => b.id === billRef.id) : undefined;
  const payingBill = isNew ? bill : undefined;

  // ID dibuat saat form dibuka: simpan ganda memakai ID yang sama (tidak duplikat).
  const [txId] = useState<ID>(() => main?.id ?? crypto.randomUUID());
  const [type, setType] = useState<EditableType>(
    (main?.type as EditableType) ??
      payingBill?.kind ??
      (TYPE_OPTIONS.some((o) => o.value === params.get('jenis')) ? (params.get('jenis') as EditableType) : 'expense'),
  );
  const [amount, setAmount] = useState<Rupiah | null>(main?.amount ?? payingBill?.amount ?? null);
  const [accountId, setAccountId] = useState<ID>(() => {
    if (main) return main.accountId;
    if (payingBill && !accountsById.get(payingBill.accountId)?.archived) return payingBill.accountId;
    const last = settings.lastUsedAccountId ? accountsById.get(settings.lastUsedAccountId) : undefined;
    return last && !last.archived ? last.id : (accounts.find((a) => !a.archived)?.id ?? '');
  });
  const [toAccountId, setToAccountId] = useState<ID>(
    main?.toAccountId ?? payingBill?.toAccountId ?? (accountsById.get(params.get('ke') ?? '')?.id || ''),
  );
  const [categoryId, setCategoryId] = useState<ID>(main?.categoryId ?? payingBill?.categoryId ?? '');
  const alreadyPaid =
    !!bill && !!billRef && transactions.some((t) => t.billId === bill.id && t.billPeriod === billRef.period && t.id !== txId);
  const [isRefund, setIsRefund] = useState(main?.isRefund ?? false);
  const [date, setDate] = useState(main?.date ?? today);
  const [note, setNote] = useState(main?.note ?? '');
  const [feeOpen, setFeeOpen] = useState(!!existing?.fee);
  const [feeAmount, setFeeAmount] = useState<Rupiah | null>(existing?.fee?.amount ?? null);
  const [feeCategoryId, setFeeCategoryId] = useState<ID>(
    existing?.fee?.categoryId ?? settings.feeCategoryId ?? categories.find((c) => c.type === 'expense')?.id ?? '',
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const amountId = useId();

  const categoryType = type === 'expense' || (type === 'income' && isRefund) ? 'expense' : 'income';
  const categoryChoices = useMemo(
    () =>
      sortCategoriesByUsage(
        categories.filter((c) => c.type === categoryType && (!c.archived || c.id === main?.categoryId)),
        transactions,
        today,
      ),
    [categories, categoryType, transactions, today, main?.categoryId],
  );

  const accountChoices = accounts.filter((a) => !a.archived || a.id === main?.accountId || a.id === main?.toAccountId);

  function changeType(next: EditableType) {
    setType(next);
    setErrors({});
    const nextCategoryType = next === 'expense' || (next === 'income' && isRefund) ? 'expense' : 'income';
    if (categoryId && data.categoriesById.get(categoryId)?.type !== nextCategoryType) setCategoryId('');
  }

  function changeRefund(next: boolean) {
    setIsRefund(next);
    setCategoryId('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFailure(null);

    const draft: TransactionDraft = {
      id: txId,
      type,
      date,
      amount: amount ?? 0,
      accountId,
      ...(type === 'transfer' ? { toAccountId } : { categoryId }),
      ...(type === 'income' && isRefund ? { isRefund: true } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(bill && billRef ? { billId: bill.id, billPeriod: billRef.period } : {}),
    };
    const fee = type === 'transfer' && feeOpen && feeAmount ? { amount: feeAmount, categoryId: feeCategoryId } : null;

    try {
      const previous = existing?.group ?? [];
      const saved = await saveTransaction(db, draft, { today, fee });
      await setSetting(db, 'lastUsedAccountId', accountId);
      toast({
        message: payingBill ? 'Tagihan dibayar' : isNew ? 'Transaksi tersimpan' : 'Perubahan tersimpan',
        actionLabel: 'Batalkan',
        onAction: () => undoSave(db, saved, previous),
      });
      goBack(navigate);
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.errors);
      else setFailure('Gagal menyimpan. Data Anda belum tersimpan; coba lagi.');
      setSaving(false);
    }
  }

  async function remove() {
    const deleted = await deleteTransaction(db, txId);
    toast({ message: 'Transaksi dihapus', actionLabel: 'Batalkan', onAction: () => restoreTransactions(db, deleted) });
    goBack(navigate);
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-dvh flex-col">
      <PageHeader title={payingBill ? 'Bayar tagihan' : isNew ? 'Tambah transaksi' : 'Ubah transaksi'} back />

      <div className="flex flex-1 flex-col gap-5 px-4 py-4">
        {bill && billRef && (
          <Alert tone={alreadyPaid ? 'warning' : 'info'}>
            <strong>
              {payingBill ? 'Membayar' : 'Pembayaran'} tagihan {bill.name}
            </strong>{' '}
            · periode {formatMonth(billRef.period)}
            {payingBill && bill.isVariable && (
              <span className="block">Nominal bisa berubah — sesuaikan dengan tagihan sebenarnya.</span>
            )}
            {alreadyPaid && <span className="block font-semibold">Periode ini sudah tercatat dibayar. Pastikan tidak tercatat dua kali.</span>}
          </Alert>
        )}
        <Segmented
          label="Jenis transaksi"
          value={type}
          onChange={changeType}
          options={TYPE_OPTIONS}
          disabled={!isNew || !!payingBill}
        />
        {!isNew && <p className="-mt-3 text-xs text-slate-500">Jenis tidak bisa diubah. Hapus lalu buat baru bila perlu.</p>}

        <div className="flex flex-col items-center gap-1 py-2 text-center">
          <label htmlFor={amountId} className="text-sm font-semibold text-slate-500">
            Nominal
          </label>
          <AmountInput
            id={amountId}
            value={amount}
            onChange={setAmount}
            size="hero"
            withThousands
            autoFocus={isNew}
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? `${amountId}-error` : undefined}
          />
          {errors.amount && (
            <p id={`${amountId}-error`} className="text-sm text-red-700">
              {errors.amount}
            </p>
          )}
        </div>

        {type === 'transfer' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Dari akun" error={errors.accountId}>
              <AccountSelect accounts={accountChoices} value={accountId} onChange={setAccountId} />
            </Field>
            <Field label="Ke akun" error={errors.toAccountId}>
              <AccountSelect accounts={accountChoices} value={toAccountId} onChange={setToAccountId} placeholder />
            </Field>
          </div>
        ) : (
          <Field label={type === 'income' ? 'Masuk ke akun' : 'Dibayar dari akun'} error={errors.accountId}>
            <AccountSelect accounts={accountChoices} value={accountId} onChange={setAccountId} />
          </Field>
        )}

        {type === 'income' && (
          <label className="flex min-h-11 items-start gap-3 rounded-[14px] border border-slate-200 bg-surface p-3.5">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-brand-700"
              checked={isRefund}
              onChange={(e) => changeRefund(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Pengembalian dana (refund)</span>
              <span className="block text-slate-500">Mengurangi pengeluaran kategori asal, bukan menambah pemasukan.</span>
            </span>
          </label>
        )}

        {type !== 'transfer' && (
          <CategoryPicker
            categories={categoryChoices}
            value={categoryId}
            onChange={setCategoryId}
            error={errors.categoryId}
            label={isRefund ? 'Kategori pengeluaran asal' : 'Kategori'}
          />
        )}

        {type === 'transfer' && (
          <div className="rounded-[14px] border border-slate-200 bg-surface">
            <button
              type="button"
              aria-expanded={feeOpen}
              className="flex min-h-12 w-full items-center justify-between px-3.5 text-sm font-semibold"
              onClick={() => setFeeOpen(!feeOpen)}
            >
              <span className="inline-flex items-center gap-1.5">
                {feeOpen ? <Minus size={ICON.sm} weight="bold" /> : <Plus size={ICON.sm} weight="bold" />} Biaya tambahan
              </span>
              <span className="text-slate-500">biaya admin / bunga cicilan</span>
            </button>
            {feeOpen && (
              <div className="flex flex-col gap-4 border-t border-slate-100 p-3">
                <Field label="Nominal biaya" error={errors.fee} hint="Dibayar dari akun asal dan dicatat sebagai pengeluaran.">
                  <AmountInput value={feeAmount} onChange={setFeeAmount} />
                </Field>
                <Field label="Kategori biaya">
                  <Select value={feeCategoryId} onChange={(e) => setFeeCategoryId(e.target.value)}>
                    {categories
                      .filter((c) => c.type === 'expense' && (!c.archived || c.id === feeCategoryId))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                  </Select>
                </Field>
              </div>
            )}
          </div>
        )}

        <Field label="Tanggal" error={errors.date}>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Hari ini', value: today },
              { label: 'Kemarin', value: addDays(today, -1) },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                aria-pressed={date === chip.value}
                onClick={() => setDate(chip.value)}
                className={cx(
                  'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
                  date === chip.value ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-surface text-slate-600',
                )}
              >
                {chip.label}
              </button>
            ))}
            <TextInput
              type="date"
              aria-label="Pilih tanggal"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto flex-1"
            />
          </div>
        </Field>

        <Field label="Catatan (opsional)" error={errors.note}>
          <TextInput value={note} maxLength={200} placeholder="Contoh: makan siang kantor" onChange={(e) => setNote(e.target.value)} />
        </Field>

        {failure && <Alert>{failure}</Alert>}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 bg-canvas/95 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <Button type="submit" block disabled={saving} className="min-h-14 rounded-2xl text-base font-bold">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </Button>
        {!isNew && (
          <Button variant="danger" block onClick={remove}>
            Hapus transaksi
          </Button>
        )}
      </div>
    </form>
  );
}

function CategoryPicker({
  categories,
  value,
  onChange,
  error,
  label,
}: {
  categories: Category[];
  value: ID;
  onChange: (id: ID) => void;
  error?: string;
  label: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? 'category-error' : undefined}>
      <legend className="mb-2 text-sm font-semibold text-slate-700">{label}</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={value === c.id}
            onClick={() => onChange(c.id)}
            className={cx(
              'flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] p-1.5 text-center text-xs leading-tight font-semibold transition-colors',
              value === c.id ? 'border-brand-600 bg-brand-50 text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-100',
            )}
          >
            <CategoryBadge icon={c.icon} color={c.color} />
            <span className="line-clamp-2">{c.name}</span>
          </button>
        ))}
      </div>
      {error && (
        <p id="category-error" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Penyesuaian saldo hanya bisa dilihat atau dihapus. */
function AdjustmentDetail({ tx }: { tx: Transaction }) {
  const { accountsById } = useData();
  const navigate = useNavigate();
  const toast = useToast();

  async function remove() {
    const deleted = await deleteTransaction(db, tx.id);
    toast({ message: 'Penyesuaian dihapus', actionLabel: 'Batalkan', onAction: () => restoreTransactions(db, deleted) });
    goBack(navigate);
  }

  return (
    <>
      <PageHeader title="Penyesuaian saldo" back />
      <div className="flex flex-col gap-4 p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-[20px] border border-slate-200 bg-surface p-4 text-sm">
          <dt className="text-slate-500">Akun</dt>
          <dd className="font-medium">{accountsById.get(tx.accountId)?.name}</dd>
          <dt className="text-slate-500">Tanggal</dt>
          <dd>{formatDisplayDate(tx.date)}</dd>
          <dt className="text-slate-500">Perubahan saldo</dt>
          <dd>
            <Money value={tx.amount} prefix={tx.adjustDirection === 'decrease' ? '−' : '+'} className="font-semibold" />
          </dd>
        </dl>
        <Alert tone="info">
          Penyesuaian tidak masuk pemasukan, pengeluaran, atau anggaran. Untuk mengoreksinya, hapus lalu lakukan Sesuaikan
          saldo lagi dari halaman akun.
        </Alert>
        <Button variant="danger" block onClick={remove}>
          Hapus penyesuaian
        </Button>
      </div>
    </>
  );
}
