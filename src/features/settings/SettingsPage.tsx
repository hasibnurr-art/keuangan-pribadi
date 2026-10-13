// Pengaturan (PRD §5.2): tampilan, pengingat backup, penyimpanan permanen, pemasangan, versi.

import { useEffect, useState } from 'react';
import { useData } from '../../app/data';
import { db } from '../../db';
import { setSetting } from '../../db/settings';
import { canPromptInstall, isIOS, isStandalone, onInstallAvailable, promptInstall, requestPersistentStorage } from '../../lib/platform';
import { Button, Card, Field, PageHeader, Select } from '../../ui/controls';

const REMINDER_OPTIONS = [3, 7, 14, 30];

function usePersistence() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
    navigator.storage?.estimate?.().then(
      (e) =>
        setUsage(
          e.usage === undefined
            ? null
            : e.usage < 1024 * 1024
              ? `${Math.max(1, Math.round(e.usage / 1024))} KB`
              : `${(e.usage / 1024 / 1024).toFixed(1)} MB`,
        ),
      () => setUsage(null),
    );
  }, []);
  return { persisted, usage, request: async () => setPersisted(await requestPersistentStorage()) };
}

export function SettingsPage() {
  const { settings } = useData();
  const storage = usePersistence();
  const [installable, setInstallable] = useState(canPromptInstall);
  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);
  const installed = isStandalone();

  return (
    <>
      <PageHeader title="Pengaturan" back />
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <h2 className="mb-3 font-semibold">Tampilan</h2>
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-brand-700"
              checked={settings.hideAmounts}
              onChange={(e) => setSetting(db, 'hideAmounts', e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Sembunyikan nominal</span>
              <span className="block text-slate-500">Semua nominal tampil sebagai Rp •••••. Bisa juga lewat tombol 👁 di Beranda.</span>
            </span>
          </label>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Backup</h2>
          <Field label="Ingatkan backup jika sudah lewat" hint="Pengingat muncul di Beranda bila ada data baru yang belum di-backup.">
            <Select
              value={settings.backupReminderDays}
              onChange={(e) => setSetting(db, 'backupReminderDays', Number(e.target.value))}
            >
              {REMINDER_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} hari
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Penyimpanan di perangkat</h2>
          <p className="text-sm text-slate-600">
            {storage.persisted === true && '✓ Penyimpanan permanen aktif: browser tidak akan menghapus data otomatis.'}
            {storage.persisted === false && 'Penyimpanan permanen belum aktif. Browser bisa menghapus data jika ruang penyimpanan penuh.'}
            {storage.persisted === null && 'Status penyimpanan tidak tersedia di browser ini.'}
          </p>
          {storage.usage && <p className="mt-1 text-xs text-slate-500">Data aplikasi memakai ±{storage.usage}.</p>}
          {storage.persisted === false && (
            <Button className="mt-3" variant="secondary" block onClick={storage.request}>
              Aktifkan penyimpanan permanen
            </Button>
          )}
          <p className="mt-2 text-xs text-slate-500">Tetap lakukan backup rutin: HP rusak atau hilang tidak bisa dicegah oleh pengaturan ini.</p>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Pasang ke layar utama</h2>
          {installed ? (
            <p className="text-sm text-slate-600">✓ Aplikasi sudah terpasang.</p>
          ) : isIOS() ? (
            <p className="text-sm text-slate-600">
              Di Safari: ketuk <strong>Bagikan</strong> → <strong>Tambah ke Layar Utama</strong> → <strong>Tambah</strong>.
            </p>
          ) : installable ? (
            <Button className="mt-2" variant="secondary" block onClick={promptInstall}>
              Pasang aplikasi
            </Button>
          ) : (
            <p className="text-sm text-slate-600">
              Buka menu browser (<strong>⋮</strong>) → <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.
            </p>
          )}
        </Card>

        <p className="px-1 text-center text-xs text-slate-500">Keuangan Pribadi versi {__APP_VERSION__}</p>
      </div>
    </>
  );
}
