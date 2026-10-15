// Buat / ubah target (PRD §9.14). Saat membuat: akun tabungan (baru atau yang ada)
// dan setoran rutin opsional dibuat sekaligus secara atomik.

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useData } from '../../app/data';
import { emergencyFundSuggestion, requiredPerMonth, type GoalDraft, type GoalErrors } from '../../domain/goals';
import type { ID, Rupiah } from '../../domain/types';
import { db } from '../../db';
import { AccountValidationError } from '../../db/accounts';
import { BillValidationError } from '../../db/bills';
import { GoalValidationError, createGoal, updateGoal } from '../../db/goals';
import { addMonths, toYearMonth } from '../../lib/date';
import { formatMonth } from '../../lib/format';
import { AccountSelect } from '../../ui/AccountSelect';
import { AmountInput } from '../../ui/AmountInput';
import { Alert, Button, Field, Money, PageHeader, Segmented, Select, TextInput, cx, goBack } from '../../ui/controls';
import { useToast } from '../../ui/toast';

const GOAL_ICONS = ['🏠', '🚗', '🏍️', '🎓', '💍', '✈️', '🕋', '👶', '💻', '📱', '🏥', '🛟', '🎯', '💰'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MULTIPLIERS = [3, 6, 12];

export function GoalFormPage() {
  const { id } = useParams();
  const { goals } = useData();
  const existing = id ? goals.find((g) => g.id === id) : undefined;
  if (id && !existing) {
    return (
      <>
        <PageHeader title="Target" back="/target" />
        <div className="p-4">
          <Alert tone="info">Target tidak ditemukan.</Alert>
        </div>
      </>
    );
  }
  return existing ? <EditGoal goalId={existing.id} /> : <NewGoal />;
}

function NewGoal() {
  const { accounts, goals, balances, transactions, today, settings } = useData();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const emergency = params.get('jenis') === 'darurat';
  const thisMonth = toYearMonth(today);

  const [multiplier, setMultiplier] = useState(6);
  const suggestion = useMemo(() => (emergency ? emergencyFundSuggestion(transactions, today, multiplier) : null), [emergency, transactions, today, multiplier]);

  const [goalId] = useState(() => crypto.randomUUID());
  const [newAccountId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(emergency ? 'Dana Darurat' : '');
  const [icon, setIcon] = useState(emergency ? '🛟' : '🎯');
  const [targetAmount, setTargetAmount] = useState<Rupiah | null>(suggestion?.amount ?? null);
  const [targetMonth, setTargetMonth] = useState(addMonths(thisMonth, emergency ? 12 : 24));

  const usedAccounts = new Set(goals.filter((g) => !g.archived).map((g) => g.accountId));
  const existingChoices = accounts.filter((a) => a.group === 'asset' && !a.archived && !usedAccounts.has(a.id));
  const [accountMode, setAccountMode] = useState<'new' | 'existing'>('new');
  const [accountName, setAccountName] = useState('');
  const [openingBalance, setOpeningBalance] = useState<Rupiah | null>(null);
  const [existingAccountId, setExistingAccountId] = useState<ID>(existingChoices[0]?.id ?? '');

  const payers = accounts.filter((a) => a.group === 'asset' && !a.archived && a.includeInAvailable);
  const [withDeposit, setWithDeposit] = useState(true);
  const [depositAmount, setDepositAmount] = useState<Rupiah | null>(null);
  const [depositEdited, setDepositEdited] = useState(false);
  const [dueDay, setDueDay] = useState(26);
  const [fromAccountId, setFromAccountId] = useState<ID>(
    payers.find((a) => a.id === settings.lastUsedAccountId)?.id ?? payers[0]?.id ?? '',
  );

  const [errors, setErrors] = useState<GoalErrors & { deposit?: string; accountName?: string; openingBalance?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountId = accountMode === 'new' ? newAccountId : existingAccountId;
  const startBalance = accountMode === 'new' ? (openingBalance ?? 0) : Math.max(0, balances.get(existingAccountId) ?? 0);
  const remaining = Math.max(0, (targetAmount ?? 0) - startBalance);
  const needed = targetMonth >= thisMonth ? requiredPerMonth(remaining, targetMonth, today) : 0;
  const deposit = depositEdited ? (depositAmount ?? 0) : needed;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFailure(null);
    setErrors({});
    const goal: GoalDraft = { id: goalId, name, icon, kind: emergency ? 'emergency' : 'custom', targetAmount: targetAmount ?? 0, targetMonth, accountId };
    if (withDeposit && deposit > 0 && fromAccountId === accountId) {
      setErrors({ deposit: 'Akun sumber setoran harus berbeda dari akun tabungan.' });
      setSaving(false);
      return;
    }
    try {
      await createGoal(db, {
        goal,
        newAccount:
          accountMode === 'new'
            ? {
                id: newAccountId,
                name: accountName.trim() || `Tabungan ${name.trim()}`.slice(0, 40),
                group: 'asset',
                kind: 'bank',
                openingBalance: openingBalance ?? 0,
                openingDate: today,
                includeInAvailable: false,
              }
            : undefined,
        deposit: withDeposit && deposit > 0 ? { amount: deposit, dueDay, fromAccountId } : undefined,
        today,
      });
      toast({ message: 'Target dibuat. Semangat menabung!' });
      navigate(`/target/${goalId}`, { replace: true });
    } catch (error) {
      if (error instanceof GoalValidationError) setErrors(error.errors);
      else if (error instanceof AccountValidationError) setErrors({ accountName: error.errors.name, openingBalance: error.errors.openingBalance });
      else if (error instanceof BillValidationError) setErrors({ deposit: Object.values(error.errors).join(' ') });
      else setFailure('Gagal menyimpan target. Coba lagi.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-dvh flex-col">
      <PageHeader title={emergency ? 'Dana Darurat' : 'Target baru'} back />
      <div className="flex flex-1 flex-col gap-5 p-4">
        {emergency && (
          <Alert tone="info">
            Dana darurat menutup kebutuhan saat ada musibah atau kehilangan penghasilan.{' '}
            {suggestion ? (
              <>
                Rata-rata pengeluaran Anda <Money value={suggestion.monthlyExpense} />
                /bulan{suggestion.months < 3 && ' (perkiraan dari data yang masih sedikit)'}.
              </>
            ) : (
              'Belum ada data pengeluaran; isi jumlahnya sendiri.'
            )}
          </Alert>
        )}

        <Field label="Nama target" error={errors.name}>
          <TextInput value={name} maxLength={40} placeholder="Contoh: DP Rumah, Motor, Biaya Kuliah" onChange={(e) => setName(e.target.value)} />
        </Field>

        <IconPicker value={icon} onChange={setIcon} />

        {emergency && suggestion && (
          <Field label="Berapa bulan pengeluaran?">
            <Select
              value={multiplier}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMultiplier(m);
                const next = emergencyFundSuggestion(transactions, today, m);
                if (next) setTargetAmount(next.amount);
              }}
            >
              {MULTIPLIERS.map((m) => (
                <option key={m} value={m}>
                  {m} bulan{m === 6 ? ' (disarankan)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Jumlah target" error={errors.targetAmount}>
          <AmountInput value={targetAmount} onChange={setTargetAmount} size="large" withThousands />
        </Field>

        <Field label="Tercapai paling lambat" error={errors.targetMonth} hint={`Akhir ${formatMonth(targetMonth || thisMonth)}`}>
          <TextInput type="month" value={targetMonth} min={thisMonth} onChange={(e) => setTargetMonth(e.target.value)} />
        </Field>

        <fieldset className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-surface p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">Disimpan di akun</legend>
          <Segmented
            label="Akun tabungan"
            value={accountMode}
            onChange={setAccountMode}
            options={[
              { value: 'new', label: 'Akun baru' },
              { value: 'existing', label: 'Akun yang ada' },
            ]}
          />
          {accountMode === 'new' ? (
            <>
              <Field label="Nama akun tabungan" error={errors.accountName}>
                <TextInput
                  value={accountName}
                  maxLength={40}
                  placeholder={`Tabungan ${name.trim() || 'Target'}`}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </Field>
              <Field label="Sudah terkumpul saat ini" hint="Isi Rp0 jika baru mulai." error={errors.openingBalance}>
                <AmountInput value={openingBalance} onChange={setOpeningBalance} />
              </Field>
              <p className="text-xs text-slate-500">
                Misalnya rekening terpisah atau fitur kantong di bank digital. Menabung = Transfer ke akun ini.
              </p>
            </>
          ) : existingChoices.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada akun aset yang bisa dipakai. Pilih "Akun baru".</p>
          ) : (
            <Field label="Pilih akun" error={errors.accountId} hint={<>Saldo saat ini <Money value={startBalance} /> dihitung sebagai terkumpul.</>}>
              <AccountSelect accounts={existingChoices} value={existingAccountId} onChange={setExistingAccountId} />
            </Field>
          )}
          {errors.accountId && accountMode === 'new' && <p className="text-sm text-red-700">{errors.accountId}</p>}
          <p className="text-xs text-slate-500">Akun ini tidak akan dihitung di Uang tersedia agar tidak terpakai belanja.</p>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-surface p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">Setoran rutin</legend>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-5 accent-brand-700" checked={withDeposit} onChange={(e) => setWithDeposit(e.target.checked)} />
            <span className="text-sm">
              <span className="font-medium">Sisihkan otomatis tiap bulan</span>
              <span className="block text-slate-500">
                Muncul sebagai tagihan di Beranda dan langsung mengurangi Uang tersedia, jadi tidak terlanjur dibelanjakan.
              </span>
            </span>
          </label>
          {withDeposit && (
            <>
              <Field
                label="Nominal per bulan"
                error={errors.deposit}
                hint={needed > 0 ? <>Agar tepat waktu perlu <Money value={needed} />/bulan.</> : undefined}
              >
                <AmountInput
                  value={depositEdited ? depositAmount : needed || null}
                  onChange={(v) => {
                    setDepositEdited(true);
                    setDepositAmount(v);
                  }}
                  withThousands
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tiap tanggal" hint="Sebaiknya setelah gajian.">
                  <Select value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Dari akun">
                  <AccountSelect accounts={payers.filter((a) => a.id !== accountId)} value={fromAccountId} onChange={setFromAccountId} />
                </Field>
              </div>
            </>
          )}
        </fieldset>

        {failure && <Alert>{failure}</Alert>}
      </div>
      <div className="sticky bottom-0 border-t border-slate-200 bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button type="submit" block disabled={saving}>
          {saving ? 'Menyimpan…' : 'Buat target'}
        </Button>
      </div>
    </form>
  );
}

function EditGoal({ goalId }: { goalId: ID }) {
  const { goals, accountsById, today } = useData();
  const goal = goals.find((g) => g.id === goalId)!;
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(goal.name);
  const [icon, setIcon] = useState(goal.icon);
  const [targetAmount, setTargetAmount] = useState<Rupiah | null>(goal.targetAmount);
  const [targetMonth, setTargetMonth] = useState(goal.targetMonth);
  const [errors, setErrors] = useState<GoalErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGoal(db, { ...goal, name, icon, targetAmount: targetAmount ?? 0, targetMonth }, today);
      toast({ message: 'Target diperbarui' });
      goBack(navigate, `/target/${goal.id}`);
    } catch (error) {
      if (error instanceof GoalValidationError) setErrors(error.errors);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-dvh flex-col">
      <PageHeader title="Ubah target" back />
      <div className="flex flex-1 flex-col gap-5 p-4">
        <Field label="Nama target" error={errors.name}>
          <TextInput value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <IconPicker value={icon} onChange={setIcon} />
        <Field label="Jumlah target" error={errors.targetAmount}>
          <AmountInput value={targetAmount} onChange={setTargetAmount} size="large" withThousands />
        </Field>
        <Field label="Tercapai paling lambat" error={errors.targetMonth}>
          <TextInput type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
        </Field>
        <p className="text-sm text-slate-600">
          Akun tabungan: <strong>{accountsById.get(goal.accountId)?.name}</strong> (tidak bisa diganti). Ubah nominal setoran rutin
          lewat menu Tagihan.
        </p>
      </div>
      <div className="sticky bottom-0 border-t border-slate-200 bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button type="submit" block disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </form>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">Ikon</legend>
      <div className="flex flex-wrap gap-1">
        {GOAL_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            aria-label={`Ikon ${icon}`}
            aria-pressed={value === icon}
            onClick={() => onChange(icon)}
            className={cx('flex size-11 items-center justify-center rounded-lg text-xl', value === icon ? 'bg-brand-100 ring-2 ring-brand-600' : 'hover:bg-slate-100')}
          >
            {icon}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
