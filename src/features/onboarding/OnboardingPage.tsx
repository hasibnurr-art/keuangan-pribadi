import { useEffect, useState } from 'react';
import { useToday } from '../../app/data';
import { validateAccount, type AccountErrors } from '../../domain/entityRules';
import { db } from '../../db';
import { completeOnboarding } from '../../db/onboarding';
import { setSetting } from '../../db/settings';
import { canPromptInstall, isIOS, isStandalone, onInstallAvailable, promptInstall, requestPersistentStorage } from '../../lib/platform';
import { Alert, Button, Field, TextInput } from '../../ui/controls';
import { AccountFields, newAccountDraft } from '../accounts/AccountFields';
import { RestorePanel } from '../data/RestorePanel';

type Step = 'welcome' | 'account' | 'install';

export function OnboardingPage() {
  const today = useToday();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [draft, setDraft] = useState(() => newAccountDraft(today));
  const [errors, setErrors] = useState<AccountErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function finish() {
    setSaving(true);
    setFailure(null);
    try {
      if (name.trim()) await setSetting(db, 'userName', name.trim());
      await completeOnboarding(db, draft, { today });
      await requestPersistentStorage();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Gagal menyimpan. Coba lagi.');
      setSaving(false);
    }
  }

  function submitAccount() {
    const result = validateAccount(draft, { accounts: [], transactions: [], today });
    setErrors(result);
    if (Object.keys(result).length > 0) return;
    if (isStandalone()) void finish();
    else setStep('install');
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {step === 'welcome' && (
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex flex-1 flex-col justify-center gap-4">
            <img src="./icon.svg" alt="" className="size-24 rounded-[26px] shadow-[0_14px_30px_-12px_rgb(8_59_55/0.6)]" />
            <div>
              <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">Selamat datang di Dompet Waras</h1>
              <p className="mt-1 font-semibold text-brand-700">Tetap waras di tengah gempuran ekonomi.</p>
            </div>
            <p className="text-slate-600">
              Catat pemasukan, pengeluaran, dan utang Anda. Lihat berapa uang yang benar-benar bisa dipakai.
            </p>
            <Alert tone="info">
              <strong>Data Anda hanya tersimpan di perangkat ini.</strong> Tidak ada server dan tidak perlu login. Lakukan
              backup rutin agar data tidak hilang jika HP rusak atau berganti.
            </Alert>
          </div>
          <div className="flex flex-col gap-2">
            <Button block onClick={() => setStep('account')}>
              Mulai baru
            </Button>
            <RestorePanel buttonLabel="Pulihkan dari file backup" />
            <p className="text-center text-xs text-slate-500">Pindah HP? Pilih file backup dari perangkat lama.</p>
          </div>
        </div>
      )}

      {step === 'account' && (
        <form
          className="flex flex-1 flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            submitAccount();
          }}
        >
          <div>
            <p className="text-sm font-medium text-brand-700">Langkah 1 dari 2</p>
            <h1 className="text-xl font-bold">Akun pertama Anda</h1>
            <p className="mt-1 text-sm text-slate-600">
              Mulai dari rekening atau dompet yang paling sering dipakai. Akun lain bisa ditambahkan nanti.
            </p>
          </div>
          <Field label="Nama panggilan (opsional)" hint="Untuk sapaan di Beranda.">
            <TextInput value={name} maxLength={30} autoComplete="given-name" placeholder="Contoh: Hasib" onChange={(e) => setName(e.target.value)} />
          </Field>
          <AccountFields
            draft={draft}
            onChange={setDraft}
            errors={errors}
            today={today}
            isNew
            allowLiability={false}
          />
          {failure && <Alert>{failure}</Alert>}
          <div className="mt-auto flex gap-2">
            <Button variant="secondary" onClick={() => setStep('welcome')}>
              Kembali
            </Button>
            <Button type="submit" block disabled={saving}>
              Lanjut
            </Button>
          </div>
        </form>
      )}

      {step === 'install' && <InstallStep saving={saving} failure={failure} onFinish={finish} />}
    </div>
  );
}

function InstallStep({ saving, failure, onFinish }: { saving: boolean; failure: string | null; onFinish: () => void }) {
  const [installable, setInstallable] = useState(canPromptInstall);
  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Langkah 2 dari 2</p>
        <h1 className="text-xl font-bold">Pasang ke layar utama</h1>
        <p className="mt-1 text-sm text-slate-600">
          Aplikasi yang dipasang lebih cepat dibuka, bisa dipakai tanpa internet, dan datanya lebih aman dari penghapusan
          otomatis oleh browser.
        </p>
      </div>

      {isIOS() ? (
        <ol className="flex list-decimal flex-col gap-2 rounded-[20px] border border-slate-200 bg-surface p-4 pl-9 text-sm">
          <li>
            Ketuk tombol <strong>Bagikan</strong> (kotak dengan panah ke atas) di Safari.
          </li>
          <li>
            Pilih <strong>Tambah ke Layar Utama</strong>.
          </li>
          <li>
            Ketuk <strong>Tambah</strong>, lalu buka aplikasi dari ikon di layar utama.
          </li>
        </ol>
      ) : installable ? (
        <Button variant="secondary" block onClick={() => promptInstall().then((ok) => ok && onFinish())}>
          Pasang aplikasi
        </Button>
      ) : (
        <ol className="flex list-decimal flex-col gap-2 rounded-[20px] border border-slate-200 bg-surface p-4 pl-9 text-sm">
          <li>
            Buka menu browser (<strong>⋮</strong>).
          </li>
          <li>
            Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.
          </li>
        </ol>
      )}

      {failure && <Alert>{failure}</Alert>}
      <Button className="mt-auto" block disabled={saving} onClick={onFinish}>
        {saving ? 'Menyimpan…' : 'Selesai, mulai mencatat'}
      </Button>
    </div>
  );
}
