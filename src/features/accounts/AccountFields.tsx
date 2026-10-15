import { ACCOUNT_KINDS, defaultIncludeInAvailable } from '../../domain/defaults';
import type { AccountDraft, AccountErrors } from '../../domain/entityRules';
import type { AccountGroup, AccountKind, LocalDate } from '../../domain/types';
import { AmountInput } from '../../ui/AmountInput';
import { Field, Segmented, Select, TextInput } from '../../ui/controls';

/** Field akun yang dipakai di onboarding dan form akun. */
export function AccountFields({
  draft,
  onChange,
  errors,
  today,
  isNew,
  groupLocked,
  allowLiability = true,
}: {
  draft: AccountDraft;
  onChange: (draft: AccountDraft) => void;
  errors: AccountErrors;
  today: LocalDate;
  isNew: boolean;
  groupLocked?: boolean;
  allowLiability?: boolean;
}) {
  const isAsset = draft.group === 'asset';
  const setKind = (kind: AccountKind) => onChange({ ...draft, kind, includeInAvailable: defaultIncludeInAvailable(kind) });
  const setGroup = (group: AccountGroup) => {
    const kind = ACCOUNT_KINDS[group][0].kind;
    onChange({ ...draft, group, kind, includeInAvailable: defaultIncludeInAvailable(kind) });
  };

  const balanceLabel = isNew
    ? isAsset
      ? 'Saldo saat ini'
      : 'Jumlah terutang saat ini'
    : isAsset
      ? 'Saldo awal'
      : 'Jumlah terutang awal';

  return (
    <div className="flex flex-col gap-4">
      {allowLiability && (
        <div className="flex flex-col gap-1.5">
          <Segmented
            label="Kelompok akun"
            value={draft.group}
            onChange={setGroup}
            disabled={groupLocked}
            options={[
              { value: 'asset', label: 'Aset / kas' },
              { value: 'liability', label: 'Utang' },
            ]}
          />
          <p className="text-xs text-slate-500">
            {groupLocked
              ? 'Kelompok tidak bisa diubah karena akun sudah punya transaksi.'
              : isAsset
                ? 'Tempat uang yang Anda miliki: tunai, rekening, e-wallet.'
                : 'Kartu kredit, PayLater, atau pinjaman. Saldonya adalah jumlah yang Anda utang.'}
          </p>
          {errors.group && <p className="text-sm text-red-700">{errors.group}</p>}
        </div>
      )}

      <Field label="Jenis">
        <Select value={draft.kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
          {ACCOUNT_KINDS[draft.group].map(({ kind, label }) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nama akun" error={errors.name}>
        <TextInput
          value={draft.name}
          maxLength={40}
          placeholder={isAsset ? 'Contoh: BCA, Tunai, GoPay' : 'Contoh: Kartu BCA, Cicilan Motor'}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </Field>

      <Field
        label={balanceLabel}
        error={errors.openingBalance}
        hint={isNew ? 'Lihat di aplikasi bank/e-wallet Anda. Boleh Rp0.' : undefined}
      >
        <AmountInput
          value={draft.openingBalance}
          onChange={(value) => onChange({ ...draft, openingBalance: value ?? 0 })}
        />
      </Field>

      <Field
        label={isNew ? 'Per tanggal' : 'Tanggal saldo awal'}
        error={errors.openingDate}
        hint="Transaksi sebelum tanggal ini tidak bisa dicatat di akun ini."
      >
        <TextInput
          type="date"
          max={today}
          value={draft.openingDate}
          onChange={(e) => onChange({ ...draft, openingDate: e.target.value })}
        />
      </Field>

      {isAsset && (
        <label className="flex min-h-11 items-start gap-3 rounded-[14px] border border-slate-200 bg-surface p-3">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-brand-700"
            checked={draft.includeInAvailable}
            onChange={(e) => onChange({ ...draft, includeInAvailable: e.target.checked })}
          />
          <span className="text-sm">
            <span className="font-medium">Hitung di Uang tersedia</span>
            <span className="block text-slate-500">
              Matikan untuk uang yang tidak dipakai sehari-hari, misalnya deposito atau emas.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

export function newAccountDraft(today: LocalDate, group: AccountGroup = 'asset'): AccountDraft {
  const kind = ACCOUNT_KINDS[group][0].kind;
  return {
    id: crypto.randomUUID(),
    name: '',
    group,
    kind,
    openingBalance: 0,
    openingDate: today,
    includeInAvailable: defaultIncludeInAvailable(kind),
  };
}
