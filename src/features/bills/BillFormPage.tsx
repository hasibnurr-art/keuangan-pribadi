import { useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useData } from '../../app/data';
import { billHasPayments, type BillDraft, type BillErrors } from '../../domain/billRules';
import type { BillKind } from '../../domain/types';
import { db } from '../../db';
import { BillValidationError, deleteBill, saveBill } from '../../db/bills';
import { toYearMonth } from '../../lib/date';
import { AccountSelect } from '../../ui/AccountSelect';
import { AmountInput } from '../../ui/AmountInput';
import { ConfirmDialog } from '../../ui/Dialog';
import { Alert, Button, Field, PageHeader, Segmented, Select, TextInput, goBack } from '../../ui/controls';
import { useToast } from '../../ui/toast';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function BillFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { bills, accounts, accountsById, categories, transactions, today, settings } = useData();
  const existing = id ? bills.find((b) => b.id === id) : undefined;
  const navigate = useNavigate();
  const toast = useToast();

  const [draft, setDraft] = useState<BillDraft>(() => {
    if (existing) return { ...existing };
    // Dari saran di halaman akun utang: "Buat tagihan bulanan untuk akun ini".
    const target = params.get('ke') ? accountsById.get(params.get('ke')!) : undefined;
    const isPayer = (a: (typeof accounts)[number]) => a.group === 'asset' && !a.archived && a.includeInAvailable && a.id !== target?.id;
    const payer = accounts.find((a) => isPayer(a) && a.id === settings.lastUsedAccountId) ?? accounts.find(isPayer);
    // Ke akun aset (tabungan target) = setoran; ke akun utang = bayar utang.
    const saving = target?.group === 'asset';
    const suggested = Number(params.get('nominal')) || 0;
    return {
      id: crypto.randomUUID(),
      name: target ? `${saving ? 'Nabung' : 'Bayar'} ${target.name}`.slice(0, 40) : '',
      kind: target ? 'transfer' : 'expense',
      amount: Number.isInteger(suggested) && suggested > 0 ? suggested : 0,
      isVariable: target ? !saving && target.kind !== 'loan' : false,
      dueDay: Number(today.slice(8, 10)),
      accountId: payer?.id ?? '',
      ...(target ? { toAccountId: target.id } : { categoryId: categories.find((c) => c.id === 'cat-tagihan' && !c.archived)?.id ?? '' }),
      startMonth: toYearMonth(today),
    };
  });
  const [errors, setErrors] = useState<BillErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (id && !existing) {
    return (
      <>
        <PageHeader title="Tagihan" back="/tagihan" />
        <div className="p-4">
          <Alert tone="info">Tagihan tidak ditemukan.</Alert>
        </div>
      </>
    );
  }

  const set = (patch: Partial<BillDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const hasPayments = existing ? billHasPayments(existing.id, transactions) : false;
  const accountChoices = accounts.filter((a) => !a.archived || a.id === draft.accountId || a.id === draft.toAccountId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFailure(null);
    try {
      await saveBill(db, draft);
      toast({ message: existing ? 'Tagihan diperbarui' : 'Tagihan tersimpan' });
      goBack(navigate, '/tagihan');
    } catch (error) {
      if (error instanceof BillValidationError) setErrors(error.errors);
      else setFailure('Gagal menyimpan tagihan. Coba lagi.');
      setSaving(false);
    }
  }

  async function remove() {
    setDeleteOpen(false);
    try {
      await deleteBill(db, draft.id);
      toast({ message: 'Tagihan dihapus' });
      navigate('/tagihan', { replace: true });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Gagal menghapus tagihan.');
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-dvh flex-col">
      <PageHeader title={existing ? 'Ubah tagihan' : 'Tambah tagihan'} back />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Field label="Nama tagihan" error={errors.name}>
          <TextInput
            value={draft.name}
            maxLength={40}
            placeholder="Contoh: Listrik PLN, Internet, Cicilan motor"
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <Segmented<BillKind>
            label="Jenis tagihan"
            value={draft.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'expense', label: 'Pengeluaran' },
              { value: 'transfer', label: 'Bayar utang' },
            ]}
          />
          <p className="text-xs text-slate-500">
            {draft.kind === 'expense'
              ? 'Untuk tagihan biasa: listrik, air, internet, sekolah, langganan.'
              : 'Untuk membayar kartu kredit, PayLater, atau pokok cicilan (transfer ke akun utang). Bunga dicatat sebagai biaya tambahan saat membayar.'}
          </p>
        </div>

        <Field label={draft.isVariable ? 'Perkiraan nominal' : 'Nominal'} error={errors.amount}>
          <AmountInput value={draft.amount || null} onChange={(v) => set({ amount: v ?? 0 })} withThousands />
        </Field>
        <label className="-mt-2 flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-brand-700"
            checked={draft.isVariable}
            onChange={(e) => set({ isVariable: e.target.checked })}
          />
          Nominal bisa berubah tiap bulan (misalnya listrik atau tagihan kartu)
        </label>

        <Field label="Jatuh tempo tiap tanggal" error={errors.dueDay} hint="Tanggal 29–31 otomatis jadi akhir bulan pada bulan yang lebih pendek.">
          <Select value={draft.dueDay} onChange={(e) => set({ dueDay: Number(e.target.value) })}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Dibayar dari akun" error={errors.accountId}>
          <AccountSelect accounts={accountChoices} value={draft.accountId} onChange={(accountId) => set({ accountId })} />
        </Field>

        {draft.kind === 'expense' ? (
          <Field label="Kategori" error={errors.categoryId}>
            <Select value={draft.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">Pilih kategori…</option>
              {categories
                .filter((c) => c.type === 'expense' && (!c.archived || c.id === draft.categoryId))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
            </Select>
          </Field>
        ) : (
          <Field label="Ke akun utang" error={errors.toAccountId}>
            <AccountSelect
              accounts={accountChoices.filter((a) => a.id !== draft.accountId)}
              value={draft.toAccountId ?? ''}
              onChange={(toAccountId) => set({ toAccountId })}
              placeholder
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai bulan" error={errors.startMonth}>
            <TextInput type="month" value={draft.startMonth} onChange={(e) => set({ startMonth: e.target.value })} />
          </Field>
          <Field label="Berakhir (opsional)" error={errors.endMonth}>
            <TextInput
              type="month"
              value={draft.endMonth ?? ''}
              min={draft.startMonth}
              onChange={(e) => set({ endMonth: e.target.value || undefined })}
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-slate-500">
          Isi bulan berakhir untuk cicilan dengan tenor tertentu. Tagihan sebelum bulan mulai tidak dihitung.
        </p>

        <Field label="Catatan (opsional)" error={errors.note}>
          <TextInput value={draft.note ?? ''} maxLength={200} onChange={(e) => set({ note: e.target.value })} />
        </Field>

        {existing && (
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-brand-700"
              checked={draft.active ?? true}
              onChange={(e) => set({ active: e.target.checked })}
            />
            <span className="text-sm">
              <span className="font-medium">Tagihan aktif</span>
              <span className="block text-slate-500">Matikan jika tagihan sudah selesai. Riwayat pembayaran tetap tersimpan.</span>
            </span>
          </label>
        )}

        {failure && <Alert>{failure}</Alert>}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button type="submit" block disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan tagihan'}
        </Button>
        {existing && !hasPayments && (
          <Button variant="danger" block onClick={() => setDeleteOpen(true)}>
            Hapus tagihan
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Hapus tagihan?"
        message={`Tagihan ${draft.name} akan dihapus. Belum ada pembayaran yang tercatat untuk tagihan ini.`}
        confirmLabel="Hapus"
        danger
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      />
    </form>
  );
}
