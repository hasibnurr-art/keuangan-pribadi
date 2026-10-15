import { Link } from 'react-router';
import { PageHeader } from '../../ui/controls';
import { CaretRight, ChartPieSlice, CreditCard, FloppyDisk, Gear, ICON, Invoice, Tag, Target } from '../../ui/icons';

const LINKS = [
  { to: '/akun', icon: CreditCard, label: 'Akun', hint: 'Rekening, e-wallet, kartu kredit, pinjaman' },
  { to: '/target', icon: Target, label: 'Target tabungan', hint: 'DP rumah, dana darurat, dan target lainnya' },
  { to: '/tagihan', icon: Invoice, label: 'Tagihan', hint: 'Tagihan rutin bulanan, cicilan, kartu kredit' },
  { to: '/anggaran', icon: ChartPieSlice, label: 'Anggaran', hint: 'Batas pengeluaran bulanan per kategori' },
  { to: '/kategori', icon: Tag, label: 'Kategori', hint: 'Ubah nama, ikon, urutan, atau arsipkan' },
  { to: '/data', icon: FloppyDisk, label: 'Backup & Data', hint: 'Backup, pulihkan, ekspor CSV' },
  { to: '/pengaturan', icon: Gear, label: 'Pengaturan', hint: 'Tampilan, pengingat backup, penyimpanan' },
];

export function MorePage() {
  return (
    <>
      <PageHeader title="Lainnya" />
      <div className="flex flex-col gap-4 p-4">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-surface">
          {LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="flex min-h-16 items-center gap-3 px-4 py-2 pressable">
                <span aria-hidden className="flex size-10 items-center justify-center rounded-[13px] bg-brand-50 text-brand-700">
                  <link.icon size={ICON.md} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{link.label}</span>
                  <span className="block text-sm text-slate-500">{link.hint}</span>
                </span>
                <CaretRight size={ICON.md} className="text-slate-400" />
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
