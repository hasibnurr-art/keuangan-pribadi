# Dompet Waras — catatan untuk melanjutkan proyek

**Dompet Waras** (dulu "Keuangan Pribadi"; tagline "Tetap waras di tengah gempuran ekonomi."): aplikasi pencatat keuangan pribadi untuk pemilik dan keluarganya. Nama repo, URL, dan id backup `keuangan-pribadi` sengaja tidak diganti agar backup lama tetap bisa dipulihkan. Logo: dompet lime tersenyum dengan plester (`public/icon.svg`; PNG dibuat ulang dengan `npx pwa-assets-generator`). Data tiap orang terpisah di perangkatnya sendiri, tanpa server dan tanpa database bersama. Spesifikasi lengkapnya ada di `docs/PRD.md` (v2.1); baca dulu sebelum menambah fitur.

- **Live:** https://hasibnurr-art.github.io/keuangan-pribadi/ (versi saat ini ada di `package.json`, terakhir 0.7.0)
- **Repo:** github.com/hasibnurr-art/keuangan-pribadi (publik, karena GitHub Pages gratis butuh repo publik)
- **Pengguna:** bukan programmer, berkomunikasi dalam Bahasa Indonesia, dan biasanya menyerahkan keputusan teknis ("rekomendasi kamu saja"). Teks UI juga berbahasa Indonesia.

## Stack

- React 19 + TypeScript strict + Vite 8 (`base: './'`) + HashRouter (react-router 8)
- Tailwind v4 lewat `@tailwindcss/vite`; token warna ada di `@theme` di `src/index.css`. Merek teal (`brand-*`), netral `slate-*` (abu kehijauan), permukaan `bg-canvas`/`bg-surface` (jangan `bg-white`), teks di atas tombol merek `text-on-brand`
- Mode gelap: `data-theme="dark"` di `<html>` (skrip di `index.html` + `src/app/theme.ts`, pilihan disimpan di localStorage `tema`). Di mode gelap token `slate-*`, `brand-*`, dan warna status dipetakan ulang di `src/index.css`, jadi komponen cukup memakai kelas biasa
- Font Plus Jakarta Sans (`@fontsource-variable/plus-jakarta-sans`, dibundel agar offline)
- Dexie 4 (IndexedDB) + dexie-react-hooks
- vite-plugin-pwa (`registerType: 'prompt'`, menampilkan banner "Muat ulang" saat ada versi baru)
- Vitest + fake-indexeddb + jsdom + Testing Library (TZ di-set Asia/Jakarta di `vitest.config.ts`)
- Ikon `@phosphor-icons/react` lewat deep import `@phosphor-icons/react/dist/csr/<Nama>`, dikumpulkan di `src/ui/icons.tsx`

## Perintah

```
npm run dev        # http://localhost:5173 (untuk uji visual pakai --port 5174 agar data asli pengguna di 5173 tidak tersentuh)
npm test           # semua tes (±174), wajib lulus sebelum push
npm run typecheck
npm run build
```

Deploy otomatis: setiap push ke `main` menjalankan `.github/workflows/deploy.yml` (typecheck → test → build → GitHub Pages). Kalau satu tes gagal di CI, versi lama tetap online.

## Struktur

- `src/domain/`: logika murni tanpa DB. `balance.ts` (saldo), `report.ts`, `budget.ts`, `bills.ts` (kemunculan tagihan, Uang tersedia), `goals.ts` (target tabungan), `validation.ts`, `defaults.ts` (kategori bawaan `cat-*`)
- `src/db/`: skema Dexie (`schema.ts`, `SCHEMA_VERSION = 2`) dan operasi tulis per entitas, semuanya atomik dengan `db.transaction`
- `src/backup/`: backup/restore JSON (validasi ketat dan migrasi per versi skema), ekspor CSV
- `src/app/data.tsx`: DataProvider yang membaca semua tabel dalam satu liveQuery/transaksi supaya data tidak pernah setengah-diperbarui
- `src/features/<fitur>/`: halaman-halaman (home, transactions, accounts, categories, budgets, reports, bills, goals, data, settings, onboarding, more)
- `src/ui/`: komponen bersama (`controls.tsx`, `charts.tsx`, `Dialog.tsx`, `icons.tsx`, `toast.tsx`, dll.)
- `src/safe/`: Mode aman (`?aman=1`) untuk menyelamatkan data jika aplikasi macet, plus perekam error

## Aturan domain penting

- Uang disimpan sebagai **rupiah bulat (integer)**; tanggal sebagai string lokal `'YYYY-MM-DD'`, bulan sebagai `'YYYY-MM'`.
- Saldo alami: akun Aset = yang dimiliki, akun Utang = yang terutang.
- Jenis transaksi: pemasukan, pengeluaran, transfer (biaya admin disimpan sebagai pengeluaran terpisah dengan `groupId` yang sama, id `${id}-fee`), dan penyesuaian saldo. Refund dicatat sebagai pemasukan dengan `isRefund` dan kategori pengeluaran.
- **Uang tersedia** = kas (akun aset dengan `includeInAvailable`) − tagihan bulan ini yang belum dibayar dari akun kas.
- Periode adalah bulan kalender. Anggaran tanpa rollover, dengan peringatan di 80%.
- Tagihan bulanan: status dibayar/dilewati/terlambat/akan datang. Tagihan yang sudah punya pembayaran tidak bisa dihapus, hanya dinonaktifkan.
- **Target tabungan:** 1 target = 1 akun aset, progresnya = saldo akun itu, dan akun target keluar dari Uang tersedia. Setoran rutin = tagihan transfer "Nabung …". Menghapus target juga menghapus setorannya (atau menonaktifkannya kalau sudah pernah dibayar). Mengarsipkan target menonaktifkan setorannya.
- Mengubah skema DB berarti: naikkan `SCHEMA_VERSION`, tambah `version(n)` di Dexie, tambah migrasi backup di `src/backup/migrate.ts`, dan perbarui validasi backup.

## Kebiasaan kerja

- Jangan pernah mengubah atau menghapus data asli pengguna (IndexedDB di localhost:5173 atau di HP).
- Commit memakai identitas lokal repo `hasibnurr-art <342126213+hasibnurr-art@users.noreply.github.com>`; jangan pakai email Gmail pengguna.
- Pengguna sudah mengizinkan commit dan push ke repo ini. Naikkan versi di `package.json` di setiap rilis, lalu cek live site memuat versi baru.
- Tes UI yang membaca data reaktif harus menunggu (`findBy…` dengan timeout), karena CI lebih lambat dari laptop.
- `gh` CLI tidak terpasang; push memakai Git Credential Manager.
- Hindari `node -e` dengan backtick atau `${}` lewat bash, karena sering rusak. Pakai Edit atau file skrip.

## Status dan ide berikutnya

Sudah selesai: M1–M6 PRD, Target tabungan, audit UI/UX (plugin ui-ux-pro-max), perbaikan bug hapus target (v0.6.2), dan desain ulang tampilan v0.7.0 (teal, Plus Jakarta Sans, mode gelap).

Pengguna sudah memutuskan **form cicilan tidak perlu** untuk saat ini.

Pilihan lanjutan yang pernah ditawarkan (belum dipilih):
- kunci PIN
- impor CSV
- backup ke Google Drive
