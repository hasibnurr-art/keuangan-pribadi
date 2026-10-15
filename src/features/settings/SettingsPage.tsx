// Pengaturan (PRD §5.2): tampilan, pengingat backup, penyimpanan permanen, pemasangan, versi.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../../app/data';
import { daysSinceBackup } from '../../domain/backupReminder';
import { setThemePref, useThemePref, type ThemePref } from '../../app/theme';
import { db } from '../../db';
import { setSetting } from '../../db/settings';
import { canPromptInstall, isIOS, isStandalone, onInstallAvailable, promptInstall, requestPersistentStorage } from '../../lib/platform';
import { Button, Card, Field, PageHeader, Segmented, TextInput } from '../../ui/controls';
import { formatDateTime } from '../../lib/format';
import { useBackup } from '../data/useBackup';

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
  const { settings, today } = useData();
  const { runBackup, busy } = useBackup();
  const [name, setName] = useState(settings.userName);
  const days = daysSinceBackup(settings.lastBackupAt, today);
  const storage = usePersistence();
  const [installable, setInstallable] = useState(canPromptInstall);
  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);
  const installed = isStandalone();
  const theme = useThemePref();

  return (
    <>
      <PageHeader title="Pengaturan" back />
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <h2 className="mb-3 font-bold">Profil</h2>
          <Field label="Nama panggilan" hint="Dipakai untuk sapaan di Beranda. Hanya tersimpan di HP ini.">
            <TextInput
              value={name}
              maxLength={30}
              autoComplete="given-name"
              placeholder="Contoh: Hasib"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setSetting(db, 'userName', name.trim())}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Tampilan</h2>
          <p className="mb-2 text-sm font-medium text-slate-700">Tema</p>
          <Segmented<ThemePref>
            label="Tema"
            value={theme}
            onChange={setThemePref}
            options={[
              { value: 'system', label: 'Otomatis' },
              { value: 'light', label: 'Terang' },
              { value: 'dark', label: 'Gelap' },
            ]}
          />
          <p className="mt-1.5 mb-4 text-xs text-slate-500">Otomatis mengikuti mode gelap di HP Anda.</p>
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-brand-700"
              checked={settings.hideAmounts}
              onChange={(e) => setSetting(db, 'hideAmounts', e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Sembunyikan nominal</span>
              <span className="block text-slate-500">Semua nominal tampil sebagai Rp •••••. Bisa juga lewat tombol mata di Beranda.</span>
            </span>
          </label>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">Backup</h2>
          <p className="text-sm text-slate-600">
            {settings.lastBackupAt
              ? `Backup terakhir ${days === 0 ? 'hari ini' : `${days} hari lalu`} · ${formatDateTime(settings.lastBackupAt)}`
              : 'Anda belum pernah membuat backup.'}
          </p>
          <Button className="mt-3" block disabled={busy} onClick={runBackup}>
            {busy ? 'Membuat backup…' : 'Backup sekarang'}
          </Button>
          <p className="mt-2 text-xs text-slate-500">
            Data hanya ada di HP ini. Backup sesekali dan simpan filenya di tempat aman. Untuk memulihkan data atau ekspor CSV,
            buka{' '}
            <Link to="/data" className="font-semibold text-brand-700">
              Backup &amp; Data
            </Link>
            .
          </p>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">Penyimpanan di perangkat</h2>
          <p className="text-sm text-slate-600">
            {storage.persisted === true && 'Penyimpanan permanen aktif: browser tidak akan menghapus data otomatis.'}
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
          <h2 className="mb-1 font-bold">Pasang ke layar utama</h2>
          {installed ? (
            <p className="text-sm text-slate-600">Aplikasi sudah terpasang di perangkat ini.</p>
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

        <p className="px-1 text-center text-xs text-slate-500">Dompet Waras versi {__APP_VERSION__}</p>
      </div>
    </>
  );
}
