# Keuangan Pribadi

PWA pencatat keuangan pribadi yang berjalan sepenuhnya di perangkat (tanpa server). Spesifikasi lengkap: [docs/PRD.md](docs/PRD.md).

## Perintah

```bash
npm install
npm run dev        # server pengembangan
npm test           # tes (zona waktu dipaksa Asia/Jakarta)
npm run coverage   # tes + cakupan
npm run typecheck
npm run build
```

## Struktur

| Folder | Isi |
| --- | --- |
| `src/features` | Layar per fitur (onboarding, dashboard, akun, kategori, transaksi, anggaran, laporan). |
| `src/app`, `src/ui` | Penyedia data reaktif, kerangka navigasi, komponen dasar. |
| `src/domain` | Fungsi murni untuk semua perhitungan keuangan: saldo, laporan, anggaran, tagihan, validasi. Tanpa React/Dexie. |
| `src/db` | Skema Dexie (IndexedDB) dan operasi tulis atomik. |
| `src/backup` | Format backup, validasi, migrasi skema, restore atomik, ekspor CSV. |
| `src/lib` | Utilitas tanggal lokal (berbasis string, tanpa pergeseran UTC), format Rupiah. |
| `src/test` | Pembuat data uji. |

## Aturan penting

- Nominal selalu **integer rupiah**. Tanggal transaksi selalu string `YYYY-MM-DD` tanggal lokal.
- UI tidak boleh menghitung angka keuangan sendiri; selalu lewat `src/domain`.
- Operasi yang menulis lebih dari satu record wajib berada di dalam `db.transaction`.
- Perubahan skema wajib menambah versi Dexie, fungsi migrasi, fixture backup, dan tes migrasi.

## Status

- [x] M1 — Fondasi (domain + database + tes)
- [x] M2 — Pencatatan (onboarding, akun, kategori, form transaksi, riwayat, sesuaikan saldo)
- [x] M3 — Insight (dashboard, anggaran, laporan + grafik SVG, sembunyikan nominal)
- [x] M4 — Tagihan (tagihan rutin, Bayar/Lewati, kartu Beranda, Uang tersedia)
- [x] M5 — Data & PWA (backup/restore JSON, CSV, pengingat, Pengaturan, offline, ikon, banner versi baru)
- [ ] M6 — Rilis
