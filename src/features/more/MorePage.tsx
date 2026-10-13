import { Link } from 'react-router';
import { PageHeader } from '../../ui/controls';

const LINKS = [
  { to: '/akun', icon: '💳', label: 'Akun', hint: 'Rekening, e-wallet, kartu kredit, pinjaman' },
  { to: '/tagihan', icon: '🧾', label: 'Tagihan', hint: 'Tagihan rutin bulanan, cicilan, kartu kredit' },
  { to: '/anggaran', icon: '🎯', label: 'Anggaran', hint: 'Batas pengeluaran bulanan per kategori' },
  { to: '/kategori', icon: '🏷️', label: 'Kategori', hint: 'Ubah nama, ikon, urutan, atau arsipkan' },
  { to: '/data', icon: '💾', label: 'Backup & Data', hint: 'Backup, pulihkan, ekspor CSV' },
  { to: '/pengaturan', icon: '⚙️', label: 'Pengaturan', hint: 'Tampilan, pengingat backup, penyimpanan' },
];

export function MorePage() {
  return (
    <>
      <PageHeader title="Lainnya" />
      <div className="flex flex-col gap-4 p-4">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-slate-50">
                <span aria-hidden className="text-xl">
                  {link.icon}
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{link.label}</span>
                  <span className="block text-sm text-slate-500">{link.hint}</span>
                </span>
                <span aria-hidden className="text-slate-400">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="px-1 text-xs text-slate-500">
          Data Anda hanya tersimpan di perangkat ini, tanpa server dan tanpa login.
        </p>
      </div>
    </>
  );
}
