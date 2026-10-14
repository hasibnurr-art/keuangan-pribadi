# Product Requirements Document (PRD)
## Aplikasi Keuangan Pribadi — Local-First PWA

**Versi:** v2.1 — MVP terpasang + Target tabungan
**Tanggal:** 13 Oktober 2026
**Pengguna:** Pemilik dan anggota keluarga, masing-masing dengan data sendiri yang terpisah
**Bahasa / mata uang:** Bahasa Indonesia · IDR saja

> PRD ini menggantikan v1.0. Versi 1.0 ditulis untuk produk komersial multi-pengguna dengan server. Versi 2.0 ditulis untuk **alat pribadi keluarga tanpa server** dan cukup konkret untuk langsung diimplementasikan. Setiap aturan di sini harus bisa diterjemahkan menjadi kode dan tes otomatis.

---

# 0. Log Keputusan

Keputusan berikut diambil saat sesi review PRD dan menjadi dasar seluruh dokumen.

| # | Keputusan | Pilihan | Konsekuensi utama |
| --- | --- | --- | --- |
| K-1 | Untuk siapa | Alat pribadi untuk pemilik dan keluarga, bukan produk publik | Tidak ada registrasi publik, monetisasi, analytics, atau gate legal komersial. |
| K-2 | Pola keluarga | Data setiap orang **terpisah total** dan tidak terhubung | Tidak ada fitur berbagi, peran, atau transaksi bersama. Aplikasi bersifat satu pengguna. |
| K-3 | Penyimpanan | **Local-only PWA**: data hanya di browser perangkat (IndexedDB) | Tanpa server, tanpa login, tanpa sinkron antarperangkat. Backup menjadi fitur kritis. |
| K-4 | Backup | **Manual**: file `.json` + pengingat | Pengingat muncul jika > 7 hari belum backup. Backup otomatis ke Google Drive masuk Fase 2. |
| K-5 | Akun & utang | Dua kelompok akun, **Aset** dan **Utang**; hanya 3 jenis transaksi + penyesuaian | Kartu kredit, PayLater, dan pinjaman masuk MVP tanpa jenis transaksi khusus. |
| K-6 | Periode | **Bulan kalender** (tanggal 1 sampai akhir bulan) | Anggaran, laporan, dan dashboard memakai bulan kalender. |
| K-7 | Anggaran | Batas per kategori per bulan, berulang otomatis, **tanpa rollover** | Tidak memakai model envelope. |
| K-8 | Tagihan | **Tagihan rutin bulanan sederhana** masuk MVP | Ada kartu "Uang tersedia". Tanpa push notification. Pembayaran selalu dikonfirmasi manual. |
| K-9 | Scope MVP | Lihat §4 | Sesuaikan saldo, sembunyikan nominal, refund sederhana, dan laporan masuk MVP. Audit trail dihapus. |
| K-10 | Stack | React + TypeScript + Vite + Dexie + Tailwind + vite-plugin-pwa + Recharts + Vitest; hosting GitHub Pages | Lihat §6. |
| K-11 | Default detail | Semua default §15 disetujui; undo hapus diubah menjadi 8 detik | PRD final untuk MVP. |
| K-12 | Target tabungan (14 Okt 2026) | 1 target = 1 akun aset khusus; setoran rutin ditawarkan sebagai tagihan; template Dana Darurat | Lihat §9.14. Skema naik ke versi 2 (tabel `goals`). Form cicilan ditunda. |

---

# 1. Ringkasan

Aplikasi web yang bisa di-*install* ke layar utama HP (PWA) untuk mencatat dan memahami keuangan pribadi. Semua data tersimpan **hanya di perangkat pengguna** dan tidak pernah dikirim ke server mana pun. Setiap anggota keluarga memakai aplikasi di perangkatnya sendiri dengan data masing-masing.

Aplikasi menjawab empat pertanyaan:
1. **Berapa uang saya sekarang**, per akun dan totalnya?
2. **Berapa yang benar-benar bisa saya pakai** setelah tagihan bulan ini?
3. **Ke mana uang saya pergi** bulan ini, dan apakah sesuai anggaran?
4. **Berapa utang saya**, dan kapan tagihan berikutnya jatuh tempo?

Pembeda utamanya: angka selalu akurat dan bisa dijelaskan, mencatat transaksi cepat, dan data sepenuhnya milik pengguna.

---

# 2. Prinsip Produk

1. **Akurasi di atas segalanya.** Setiap angka diturunkan dari transaksi melalui fungsi murni yang teruji. Tidak ada angka ringkasan yang disimpan atau diedit manual.
2. **Bisa dijelaskan.** Setiap angka utama bisa diketuk untuk melihat rincian dan transaksi pembentuknya.
3. **Cepat dicatat.** Transaksi sederhana bisa disimpan dalam ≤ 10 detik.
4. **Data milik pengguna.** Tanpa server, tanpa analytics, tanpa request jaringan saat runtime. Backup dan ekspor selalu tersedia.
5. **Tidak menghakimi.** Bahasa netral ("Anggaran Makan terlampaui Rp120.000"), bukan "Kamu boros".
6. **Sederhana dulu.** Fitur yang tidak ada di MVP tidak boleh meninggalkan UI setengah jadi.

---

# 3. Pengguna dan Konteks Pemakaian

| Aspek | Ketentuan |
| --- | --- |
| Pengguna | Pemilik dan anggota keluarga dewasa. Masing-masing memakai perangkat sendiri. |
| Satu dataset per | Kombinasi **browser + perangkat + alamat situs**. Dua orang yang memakai browser yang sama di satu perangkat akan berbagi data (tidak didukung, dan cukup dijelaskan di FAQ). |
| Perangkat | HP Android dan iPhone (utama), laptop (sekunder). Tidak ada sinkron antarperangkat. |
| Pindah perangkat | Backup di perangkat lama, lalu restore di perangkat baru. |
| Literasi keuangan | Awam. Hindari istilah akuntansi (debit/kredit, ledger, ekuitas) di UI. |

### Jobs to be done
- Saat membayar sesuatu, saya ingin mencatatnya dalam beberapa ketukan.
- Saat membuka aplikasi, saya ingin langsung tahu berapa uang yang aman dipakai sampai akhir bulan.
- Saat memindahkan uang atau membayar kartu kredit, saya tidak ingin pengeluaran terhitung dua kali.
- Saat saldo di aplikasi berbeda dengan saldo bank, saya ingin menyamakannya dengan cepat.
- Saat ganti HP, saya ingin semua data pindah utuh.

---

# 4. Ruang Lingkup

## 4.1 MVP

| ID | Fitur | Ringkasan |
| --- | --- | --- |
| F-01 | Onboarding | Mulai baru atau pulihkan dari backup; buat akun pertama; kategori default otomatis. |
| F-02 | Akun | Kelompok Aset (tunai, bank, e-wallet, aset lain) dan Utang (kartu kredit, PayLater, pinjaman, utang lain). Buat, ubah, arsipkan. |
| F-03 | Transaksi | Pemasukan, Pengeluaran, Transfer (dengan biaya tambahan opsional). Tambah, ubah, hapus dengan undo. |
| F-04 | Refund | Pemasukan yang ditandai "Pengembalian dana" mengurangi pengeluaran kategori asal. |
| F-05 | Sesuaikan saldo | Masukkan saldo sebenarnya, lalu sistem mencatat transaksi Penyesuaian sebesar selisihnya. |
| F-06 | Kategori | Kategori default (satu tingkat), tambah, ubah, arsipkan. |
| F-07 | Riwayat & pencarian | Daftar dikelompokkan per tanggal, pencarian teks, filter bulan/jenis/akun/kategori. |
| F-08 | Anggaran | Batas bulanan per kategori pengeluaran; terpakai, sisa, status. |
| F-09 | Tagihan rutin | Template bulanan; status terlambat/akan datang/dibayar/dilewati; bayar dengan form yang terisi otomatis. |
| F-10 | Dashboard | Uang tersedia, ringkasan bulan ini, tagihan, anggaran berisiko, saldo akun, kekayaan bersih, transaksi terbaru. |
| F-11 | Laporan | Pengeluaran per kategori per bulan; tren 6 bulan pemasukan vs pengeluaran; drill-down ke transaksi. |
| F-12 | Backup & restore | File `.json` lengkap; restore dengan validasi dan preview; pengingat backup. |
| F-13 | Ekspor CSV | Transaksi ke CSV untuk dibuka di Excel/Sheets. |
| F-14 | Sembunyikan nominal | Tombol mata untuk menyamarkan semua nominal (`Rp •••••`). |
| F-15 | PWA & penyimpanan | Install ke layar utama, offline penuh, permintaan *persistent storage*, banner pembaruan versi. |

## 4.2 Fase 2 (setelah MVP dipakai stabil ≥ 1 bulan)
- Mode gelap
- Kunci PIN aplikasi
- Impor CSV dari bank
- Backup otomatis ke Google Drive pribadi
- Backup terenkripsi dengan kata sandi
- Subkategori
- Tagihan dengan siklus mingguan/tahunan
- Proyeksi saldo 30 hari

## 4.3 Tidak akan dikerjakan
- Server, akun online, login, sinkronisasi antarperangkat, fitur berbagi keluarga
- Split transaksi (satu struk → banyak kategori)
- Foto struk, OCR, AI, saran otomatis
- Multi-mata uang
- Integrasi bank/e-wallet, pembayaran sungguhan
- Push notification
- Audit trail atau riwayat perubahan transaksi
- Analytics atau telemetri apa pun

---

# 5. Navigasi dan Layar

## 5.1 Navigasi bawah (mobile)

`Beranda` · `Transaksi` · **[ + ]** · `Laporan` · `Lainnya`

- **[ + ]** membuka form transaksi (default: Pengeluaran).
- **Lainnya** berisi: Akun, Anggaran, Tagihan, Kategori, Backup & Data, Pengaturan, Bantuan.
- Di desktop (≥ 1024px), navigasi menjadi sidebar kiri dan konten dibatasi lebar maksimal ±960px. Logika dan fitur tetap identik dengan mobile.

## 5.2 Daftar layar

| Layar | Isi | State wajib |
| --- | --- | --- |
| Onboarding | Selamat datang → Mulai baru / Pulihkan backup → Akun pertama → Panduan pasang ke layar utama | Restore gagal; lewati panduan install |
| Beranda | Lihat §9.10 | Belum ada akun; belum ada transaksi; nominal disembunyikan; banner backup |
| Form transaksi | Lihat §9.3 | Error validasi per field; mode edit; mode bayar tagihan |
| Daftar transaksi | Grup per tanggal + total harian; pencarian; chip filter | Kosong; hasil filter kosong; filter aktif |
| Akun (daftar) | Kelompok Aset dan Utang dengan saldo; total; kekayaan bersih | Belum ada akun; akun terarsip (disembunyikan, bisa ditampilkan) |
| Detail akun | Saldo, riwayat transaksi akun, tombol Sesuaikan saldo, Ubah, Arsipkan | Saldo ≠ 0 saat arsip |
| Anggaran | Daftar kategori dengan batas, terpakai, sisa, progress bar dan label status | Belum ada anggaran; terlampaui |
| Tagihan | Kelompok Terlambat, Bulan ini, Bulan depan; tombol Bayar/Lewati | Belum ada tagihan; semua lunas |
| Laporan | Pilih bulan; pemasukan/pengeluaran/selisih; per kategori; tren 6 bulan | Data kurang dari 1 bulan |
| Kategori | Daftar pemasukan dan pengeluaran; tambah, ubah, arsip | Kategori sedang dipakai saat dihapus |
| Backup & Data | Backup sekarang, info backup terakhir, Pulihkan, Ekspor CSV, Hapus semua data | Proses berjalan; file tidak valid |
| Pengaturan | Sembunyikan nominal default, ambang pengingat backup, status penyimpanan permanen, versi aplikasi | — |

---

# 6. Arsitektur Teknis

## 6.1 Stack

| Bagian | Pilihan |
| --- | --- |
| Bahasa | TypeScript (`strict: true`) |
| UI | React 18+ dan React Router |
| Build | Vite |
| Styling | Tailwind CSS |
| Database lokal | Dexie.js (IndexedDB) |
| PWA | vite-plugin-pwa (Workbox), strategi precache seluruh aset |
| Grafik | Recharts |
| Tes | Vitest (logika domain), fake-indexeddb (tes repositori), Testing Library (komponen penting) |
| Hosting | GitHub Pages, alamat `https://<username>.github.io/<repo>/` |

## 6.2 Struktur kode

```
src/
  domain/        ← fungsi MURNI: saldo, laporan, anggaran, tagihan, validasi (tanpa React/Dexie)
  db/            ← skema Dexie, migrasi, repositori (semua tulis multi-record dalam db.transaction)
  backup/        ← serialisasi, validasi, migrasi format, restore atomik, CSV
  features/      ← layar per fitur (dashboard, transactions, accounts, budgets, bills, reports, settings)
  ui/            ← komponen bersama (AmountInput, Money, BottomSheet, Toast, ...)
  lib/           ← format Rupiah/tanggal, id, tanggal lokal
tests/fixtures/  ← file backup contoh per versi skema (untuk tes migrasi)
```

**Aturan arsitektur:** semua perhitungan keuangan berada di `src/domain` sebagai fungsi murni yang menerima array data dan mengembalikan angka. UI tidak boleh menghitung angka keuangan sendiri.

## 6.3 Aturan teknis wajib
- **Nominal = integer rupiah** (`number`, bilangan bulat, 1 ≤ nominal ≤ 1.000.000.000.000). Tidak ada desimal atau float untuk uang.
- **Tanggal transaksi = string `YYYY-MM-DD` tanggal lokal perangkat.** Tidak disimpan sebagai timestamp UTC, supaya tidak ada pergeseran hari.
- Timestamp sistem (`createdAt`, `updatedAt`) memakai ISO 8601 UTC.
- **ID = `crypto.randomUUID()`**, dibuat saat form dibuka. Simpan memakai `put` dengan ID itu, sehingga submit ganda tidak membuat duplikat.
- Setiap operasi yang menulis > 1 record (transfer + biaya, restore, hapus grup) wajib dibungkus `db.transaction('rw', ...)`: semuanya tersimpan atau tidak sama sekali.
- **Tidak ada request jaringan saat runtime.** Font dan ikon di-bundle. CSP: `default-src 'self'`.
- Format tampilan memakai `Intl.NumberFormat('id-ID')`, contohnya `Rp1.250.000`. Tanggal ditampilkan seperti `13 Okt 2026`.
- Saat aplikasi pertama kali dipakai (setelah onboarding), panggil `navigator.storage.persist()`. Statusnya ditampilkan di Pengaturan.
- Jika ada versi baru (service worker baru), tampilkan banner "Versi baru tersedia · Muat ulang". Jangan reload otomatis saat pengguna sedang mengisi form.

## 6.4 Hosting dan alamat
- Deploy otomatis lewat GitHub Actions saat push ke `main`.
- **Alamat situs tidak boleh berubah setelah dipakai.** IndexedDB terikat pada origin; jika alamat berubah, data tidak ikut pindah dan harus dipulihkan dari backup. Kalau suatu saat pindah ke domain sendiri, wajibkan backup sebelum pindah.

---

# 7. Model Data

Skema Dexie versi 1. Setiap perubahan skema menambah versi Dexie dan **wajib** disertai fungsi migrasi serta tes dengan fixture backup lama.

```ts
type ID = string;           // UUID
type LocalDate = string;    // 'YYYY-MM-DD'
type YearMonth = string;    // 'YYYY-MM'
type Rupiah = number;       // integer

interface Account {
  id: ID;
  name: string;                         // wajib, ≤ 40 karakter, unik di antara akun aktif
  group: 'asset' | 'liability';
  kind: 'cash' | 'bank' | 'ewallet' | 'other_asset'
      | 'credit_card' | 'paylater' | 'loan' | 'other_liability';
  openingBalance: Rupiah;               // ≥ 0. Aset = uang dimiliki; Utang = jumlah terutang
  openingDate: LocalDate;               // saldo awal berlaku pada awal hari ini
  includeInAvailable: boolean;          // dihitung di "Uang tersedia" (hanya untuk aset)
  archived: boolean;
  sortOrder: number;
  createdAt: string; updatedAt: string;
}

interface Category {
  id: ID;
  name: string;                         // wajib, ≤ 30 karakter, unik per type di antara yang aktif
  type: 'income' | 'expense';
  icon: string;                         // emoji
  color: string;                        // token warna dari palet tetap
  archived: boolean;
  sortOrder: number;
}

interface Transaction {
  id: ID;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  date: LocalDate;
  amount: Rupiah;                       // selalu > 0
  accountId: ID;                        // income: akun tujuan; expense/adjustment: akun terkait; transfer: akun asal
  toAccountId?: ID;                     // hanya transfer
  categoryId?: ID;                      // income/expense wajib; refund → kategori PENGELUARAN
  isRefund?: boolean;                   // hanya income
  adjustDirection?: 'increase' | 'decrease'; // hanya adjustment, arah terhadap saldo natural
  note?: string;                        // ≤ 200 karakter
  groupId?: ID;                         // menghubungkan transfer dengan biaya tambahannya
  billId?: ID;                          // jika transaksi ini pembayaran tagihan
  billPeriod?: YearMonth;
  createdAt: string; updatedAt: string;
}

interface BudgetLimit {                 // batas berlaku mulai bulan effectiveFrom sampai ada record lebih baru
  id: ID;
  categoryId: ID;                       // kategori pengeluaran
  effectiveFrom: YearMonth;
  amount: Rupiah;                       // 0 = anggaran dihentikan mulai bulan ini
}

interface Bill {
  id: ID;
  name: string;
  kind: 'expense' | 'transfer';         // listrik = expense; bayar kartu/cicilan = transfer ke akun utang
  amount: Rupiah;                       // nominal (estimasi jika isVariable)
  isVariable: boolean;
  dueDay: number;                       // 1–31; jika melebihi jumlah hari di bulan itu → hari terakhir bulan
  accountId: ID;                        // akun pembayar
  toAccountId?: ID;                     // untuk kind = transfer
  categoryId?: ID;                      // untuk kind = expense
  startMonth: YearMonth;
  endMonth?: YearMonth;                 // opsional, misalnya cicilan berakhir
  active: boolean;
  note?: string;
}

interface BillSkip { billId: ID; period: YearMonth; }

interface Goal {                        // skema v2 (§9.14)
  id: ID;
  name: string;                         // wajib, ≤ 40 karakter
  icon: string;
  kind: 'custom' | 'emergency';
  targetAmount: Rupiah;                 // ≥ 1
  targetMonth: YearMonth;               // tercapai paling lambat akhir bulan ini
  accountId: ID;                        // akun ASET khusus; 1 akun hanya untuk 1 target aktif
  startDate: LocalDate;                 // titik awal jadwal
  startAmount: Rupiah;                  // saldo akun saat target dibuat
  archived: boolean;
  sortOrder: number;
  createdAt: string; updatedAt: string;
}

interface Setting { key: string; value: unknown; }
// keys: onboardingDone, lastBackupAt, lastDataChangeAt, backupReminderDays (7),
//       hideAmounts (false), feeCategoryId, lastUsedAccountId, installHintDismissed
```

**Index Dexie:**
```
accounts:     'id, group, archived'
categories:   'id, type, archived'
transactions: 'id, date, type, accountId, toAccountId, categoryId, groupId, [billId+billPeriod]'
budgetLimits: 'id, categoryId, effectiveFrom'
bills:        'id, active'
billSkips:    '[billId+period]'
settings:     'key'
```

Setiap operasi tulis ke tabel data memperbarui `settings.lastDataChangeAt`.

---

# 8. Aturan Bisnis Keuangan

## 8.1 Saldo natural
- Akun **Aset**: saldo = uang yang **dimiliki**.
- Akun **Utang**: saldo = uang yang **terutang**, ditampilkan positif (misalnya "Kartu BCA: Rp2.300.000 terutang").

Definisikan dua operasi untuk akun X dan nominal a:
- `masuk(X, a)`: Aset → `+a`; Utang → `−a` (utang berkurang)
- `keluar(X, a)`: Aset → `−a`; Utang → `+a` (utang bertambah)

## 8.2 Efek tiap jenis transaksi

| Jenis | Efek saldo | Masuk "Pemasukan"? | Masuk "Pengeluaran"? | Masuk anggaran? |
| --- | --- | --- | --- | --- |
| Pemasukan | `masuk(akun)` | Ya | Tidak | Tidak |
| Pemasukan + refund | `masuk(akun)` | **Tidak** | Mengurangi kategori terkait | Mengurangi terpakai |
| Pengeluaran | `keluar(akun)` | Tidak | Ya | Ya |
| Transfer | `keluar(asal)`, `masuk(tujuan)` | Tidak | Tidak | Tidak |
| Penyesuaian | `±a` pada saldo natural sesuai `adjustDirection` | Tidak | Tidak | Tidak |

**Saldo akun** pada tanggal D = `openingBalance` + Σ efek semua transaksi akun itu dengan `openingDate ≤ date ≤ D`.

## 8.3 Contoh kasus (wajib menjadi tes)

| Kasus | Cara dicatat | Hasil |
| --- | --- | --- |
| Belanja Rp500rb dengan kartu kredit | Pengeluaran dari "Kartu BCA" | Pengeluaran +500rb; utang kartu +500rb |
| Bayar tagihan kartu Rp500rb | Transfer BCA → Kartu BCA | BCA −500rb; utang −500rb; pengeluaran tidak berubah |
| Terima pinjaman Rp2jt | Transfer Pinjaman → BCA | BCA +2jt; utang +2jt; pemasukan tidak berubah |
| Cicilan: pokok Rp200rb + bunga Rp15rb | Transfer BCA → Pinjaman 200rb dengan **biaya tambahan** 15rb (kategori Bunga & Biaya Admin) | BCA −215rb; utang −200rb; pengeluaran +15rb |
| Transfer Rp1jt ke e-wallet, biaya admin Rp2.500 | Transfer BCA → GoPay 1jt dengan biaya tambahan 2.500 | BCA −1.002.500; GoPay +1jt; pengeluaran +2.500 |
| Refund makanan Rp20rb | Pemasukan, "Pengembalian dana", kategori Makan & Minum | Akun +20rb; pengeluaran Makan −20rb; pemasukan tidak berubah |
| Saldo awal Rp3jt | `openingBalance` akun | Saldo 3jt; pemasukan tidak berubah |

**Biaya tambahan pada transfer** disimpan sebagai transaksi `expense` terpisah dari akun asal, dengan `groupId` yang sama dan `date` yang sama. Kategori default diambil dari `settings.feeCategoryId` (Bunga & Biaya Admin) dan bisa diganti. Mengubah atau menghapus salah satu berarti mengubah atau menghapus seluruh grup secara atomik.

## 8.4 Definisi angka

| Angka | Rumus |
| --- | --- |
| **Total kas** | Σ saldo akun Aset, tidak diarsipkan, `includeInAvailable = true` |
| **Total utang** | Σ saldo akun Utang yang tidak diarsipkan |
| **Kekayaan bersih** | Σ saldo semua akun Aset − Σ saldo semua akun Utang |
| **Pemasukan bulan M** | Σ `income` non-refund dengan `date` di bulan M |
| **Pengeluaran bulan M** | Σ `expense` di bulan M − Σ refund di bulan M |
| **Selisih bulan M** | Pemasukan − Pengeluaran |
| **Pengeluaran kategori C, bulan M** | Σ `expense` kategori C − Σ refund kategori C, di bulan M (boleh negatif; tampil apa adanya) |
| **Anggaran terpakai** | Pengeluaran kategori C bulan M; persentase = terpakai ÷ batas (hanya jika batas > 0) |
| **Uang tersedia** | Total kas − Σ nominal tagihan **belum dibayar dan belum dilewati** yang jatuh tempo **≤ akhir bulan ini** (termasuk yang terlambat dari bulan sebelumnya) dan **akun pembayarnya** adalah akun Aset dengan `includeInAvailable = true` |

Catatan:
- Pengeluaran dengan kartu kredit terhitung saat belanja, bukan saat tagihan dibayar. Ini dijelaskan di tooltip laporan.
- Tagihan yang dibayar dengan kartu kredit (misalnya Netflix via kartu) **tidak** mengurangi Uang tersedia karena kas belum keluar. Tagihan kartu itu sendiri sebaiknya dibuat sebagai tagihan Transfer, dan aplikasi menyarankannya saat pengguna membuat akun kartu kredit.
- Ketuk "Uang tersedia" untuk melihat rincian: daftar akun kas beserta saldonya, dikurangi daftar tagihan beserta nominalnya.

## 8.5 Status anggaran
| Terpakai | Label | Warna + ikon |
| --- | --- | --- |
| < 80% | Aman | hijau ✓ |
| 80–100% | Hampir habis | amber ⚠ |
| > 100% | Terlampaui Rp X | merah ! |

Batas yang berlaku untuk bulan M = `BudgetLimit` dengan `effectiveFrom ≤ M` paling baru. Mengubah batas membuat record baru dengan `effectiveFrom` = bulan berjalan, sehingga bulan lalu tetap memakai batas lamanya.

## 8.6 Status tagihan (untuk bulan P antara `startMonth` dan `endMonth`)
1. **Dibayar**: ada transaksi dengan `billId` dan `billPeriod = P`.
2. **Dilewati**: ada `BillSkip(billId, P)`.
3. **Terlambat**: tidak dibayar/dilewati dan tanggal jatuh tempo < hari ini.
4. **Akan datang**: selain itu.

Ketentuan tambahan:
- Tagihan baru dihitung sejak `startMonth`, dan tidak ada tagihan "terlambat" sebelum tagihan itu dibuat.
- Menghapus transaksi pembayaran mengembalikan status tagihan ke belum dibayar.
- Satu periode hanya punya satu pembayaran. Kalau pengguna membayar lagi, tampilkan peringatan.
- Menonaktifkan tagihan menghentikan kemunculan periode berikutnya. Riwayat pembayaran tetap ada.

## 8.7 Validasi
- `amount` integer, ≥ 1, ≤ 1.000.000.000.000.
- `date` ≤ hari ini. Transaksi masa depan **tidak diizinkan**; rencana masa depan memakai Tagihan.
- `date` ≥ `openingDate` akun terkait (keduanya untuk transfer). Pesan: *"Tanggal sebelum saldo awal akun BCA (1 Okt 2026). Ubah tanggal saldo awal di pengaturan akun untuk mencatat transaksi lama."*
- Transfer: akun asal ≠ akun tujuan.
- Jenis transaksi **tidak bisa diubah** setelah disimpan. Untuk mengganti jenis, hapus lalu buat ulang. Semua field lain bisa diedit.
- Akun hanya bisa **diarsipkan** jika saldonya Rp0 (sarankan Sesuaikan saldo atau Transfer dulu). Akun hanya bisa **dihapus** jika belum punya transaksi.
- Kategori yang sudah dipakai hanya bisa **diarsipkan**: tidak muncul di pilihan baru, tetapi tetap tampil di riwayat dan laporan.

---

# 9. Kebutuhan Fungsional dan Acceptance Criteria

## 9.1 Onboarding (F-01)
1. Layar sambutan dengan pesan kunci: *"Data Anda hanya tersimpan di perangkat ini. Lakukan backup rutin agar tidak hilang."*
2. Pilihan: **Mulai baru** atau **Pulihkan dari backup** (alur §9.12).
3. Buat akun pertama: nama (contoh "BCA"), jenis, saldo saat ini, tanggal (default hari ini).
4. Kategori default dibuat otomatis (§9.6).
5. Panggil `navigator.storage.persist()`.
6. Jika belum berjalan sebagai aplikasi terpasang (`display-mode: standalone` = false), tampilkan panduan "Pasang ke layar utama" sesuai platform: iOS (Share → Add to Home Screen) atau Android/Chrome (prompt install). Panduan bisa dilewati.

**AC:** Onboarding yang diulang (misalnya karena refresh di tengah jalan) tidak membuat akun atau kategori ganda.

## 9.2 Akun (F-02)
- Form: nama, kelompok (Aset/Utang), jenis, saldo awal, tanggal saldo awal, "Hitung di Uang tersedia" (hanya untuk Aset; default **on** untuk tunai/bank/e-wallet dan **off** untuk aset lain).
- Daftar akun dikelompokkan Aset dan Utang, masing-masing dengan subtotal, ditutup dengan Kekayaan bersih.
- Saat membuat akun Kartu kredit/PayLater/Pinjaman, tampilkan saran opsional: *"Buat tagihan bulanan untuk akun ini?"*

## 9.3 Form transaksi (F-03)
- Tab jenis di atas: **Pengeluaran** (default) · Pemasukan · Transfer.
- **Nominal** menjadi elemen terbesar, memakai `inputmode="numeric"` dan pemisah ribuan otomatis saat mengetik. Pintasan `000` disediakan.
- **Akun**: default akun terakhir dipakai. Akun terarsip tidak muncul.
- **Kategori**: grid ikon, diurutkan dari yang paling sering dipakai 30 hari terakhir. Tidak berlaku untuk Transfer.
- **Tanggal**: default hari ini, dengan chip "Hari ini" dan "Kemarin" serta date picker.
- **Catatan**: opsional.
- Pemasukan: toggle **"Pengembalian dana (refund)"**. Jika aktif, pemilih kategori menampilkan kategori **pengeluaran**.
- Transfer: Dari, Ke, dan bagian lipat **"+ Biaya tambahan"** (nominal + kategori, default Bunga & Biaya Admin).
- Satu tombol utama: **Simpan**. Tombol dinonaktifkan selama proses simpan.
- Setelah simpan: form tertutup dan muncul toast *"Tersimpan · Batalkan"* (8 detik).
- Error tampil di bawah field terkait. Input yang sudah diisi tidak hilang.
- Mode edit memakai form yang sama, dengan tombol Hapus di bawah. Setelah hapus muncul toast *"Dihapus · Batalkan"* (8 detik). Undo mengembalikan record yang identik, termasuk ID-nya.

**AC:**
- Saldo, anggaran, laporan, dan dashboard langsung mencerminkan perubahan (query reaktif `useLiveQuery`).
- Ketuk Simpan dua kali dengan cepat hanya menghasilkan satu transaksi.
- Menyimpan transaksi sederhana (nominal → kategori → simpan) bisa dilakukan dalam ≤ 4 ketukan setelah form terbuka.

## 9.4 Refund (F-04)
Lihat §8.2–8.4. Di daftar transaksi, refund ditandai label "Refund" dan ikon kategori pengeluarannya.

## 9.5 Sesuaikan saldo (F-05)
1. Di detail akun → **Sesuaikan saldo** → masukkan saldo sebenarnya (sesuai aplikasi bank atau dompet).
2. Tampilkan: *"Saldo di aplikasi Rp1.200.000 · Saldo sebenarnya Rp1.150.000 · Selisih −Rp50.000"*.
3. Simpan membuat transaksi `adjustment` bertanggal hari ini sebesar selisihnya. Jika selisih 0, tidak ada yang dibuat.
4. Penyesuaian tampil di riwayat dengan label "Penyesuaian saldo" dan **tidak** masuk pemasukan, pengeluaran, atau anggaran.

## 9.6 Kategori (F-06)
**Pengeluaran default:** Makan & Minum 🍜, Belanja Harian 🛒, Transportasi 🚗, Tagihan & Utilitas 💡, Pulsa & Internet 📱, Kesehatan 🏥, Pendidikan 🎓, Rumah Tangga 🏠, Belanja Pribadi 🛍️, Hiburan 🎬, Keluarga & Sosial 🎁, Zakat & Sedekah 🤲, Bunga & Biaya Admin 🏦, Lainnya 📦.

**Pemasukan default:** Gaji 💼, Bonus & THR 🎉, Usaha Sampingan 🧰, Hadiah 🎁, Bunga & Imbal Hasil 📈, Lainnya 📦.

Semua kategori, termasuk default, bisa diubah nama, ikon, dan urutannya, atau diarsipkan. Minimal harus tersisa 1 kategori aktif per jenis.

## 9.7 Riwayat & pencarian (F-07)
- Dikelompokkan per tanggal (terbaru di atas), dengan total pengeluaran harian di header grup.
- Pencarian mencakup catatan, nama kategori, dan nama akun (tidak peka huruf besar/kecil).
- Filter (bisa dikombinasikan): bulan, jenis, akun, kategori. Ada tombol "Reset filter" dan jumlah hasil.
- Daftar dimuat bertahap (virtualized/infinite) supaya tetap lancar dengan 20.000+ transaksi.

## 9.8 Anggaran (F-08)
- Tetapkan batas per kategori pengeluaran. Berlaku setiap bulan sampai diubah atau dihentikan.
- Layar menampilkan: kategori, batas, terpakai, sisa (atau "Lewat Rp X"), progress bar, dan label status (§8.5).
- Ketuk kategori untuk melihat daftar transaksi pembentuk angka terpakai.
- Pemilih bulan untuk melihat anggaran bulan sebelumnya.
- Peringatan hanya tampil di dalam aplikasi (dashboard). Tidak ada notifikasi.

## 9.9 Tagihan rutin (F-09)
- Form: nama, jenis (Pengeluaran/Transfer ke akun utang), nominal, "Nominal bisa berubah", tanggal jatuh tempo (1–31), akun pembayar, kategori atau akun tujuan, bulan mulai, bulan berakhir (opsional).
- Layar Tagihan dikelompokkan **Terlambat**, **Bulan ini**, dan **Bulan depan**.
- **Bayar** membuka form transaksi yang sudah terisi (nominal, akun, kategori/tujuan, tanggal hari ini, `billId`, `billPeriod`). Pengguna bisa mengubah nominal sebelum simpan. Untuk tagihan Transfer, bagian "Biaya tambahan" tersedia (misalnya bunga cicilan).
- **Lewati bulan ini** membuat `BillSkip`.
- Tidak ada transaksi yang dibuat otomatis tanpa konfirmasi pengguna.

## 9.10 Dashboard (F-10)
Urutan dari atas:
1. **Banner backup** (jika perlu, §9.12).
2. **Uang tersedia**: angka besar dengan subteks "setelah tagihan s.d. akhir bulan". Diketuk membuka rincian.
3. **Bulan ini**: Pemasukan · Pengeluaran · Selisih. Diketuk membuka Laporan bulan ini.
4. **Tagihan**: yang terlambat (teks "Terlambat X hari" + ikon) dan yang jatuh tempo ≤ 14 hari ke depan, maksimal 5. Masing-masing punya tombol Bayar.
5. **Anggaran**: maksimal 3 kategori dengan persentase tertinggi (yang ≥ 80% didahulukan). Link "Lihat semua".
6. **Akun**: total kas, total utang, kekayaan bersih. Bisa dibuka untuk melihat per akun.
7. **Transaksi terbaru**: 5 terakhir.

Di header ada tombol 👁 untuk sembunyikan/tampilkan nominal (F-14), yang berlaku di seluruh aplikasi.

## 9.11 Laporan (F-11)
- Pemilih bulan (default bulan ini).
- Kartu Pemasukan, Pengeluaran, Selisih, ditambah perbandingan dengan bulan sebelumnya (± Rp dan %).
- Pengeluaran per kategori: daftar dengan bar horizontal, nominal, dan % dari total, diurutkan dari terbesar. Ketuk kategori untuk melihat transaksinya.
- Tren 6 bulan: grafik batang pemasukan vs pengeluaran, **disertai tabel angka** di bawahnya (tidak hanya grafik).
- Semua total identik dengan jumlah daftar rinciannya (selisih Rp0).

## 9.12 Backup & restore (F-12)

**Format file** (`keuangan-backup-2026-10-13-2130.json`):
```json
{
  "app": "keuangan-pribadi",
  "formatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-10-13T14:30:00.000Z",
  "counts": { "accounts": 5, "categories": 20, "transactions": 1234, "budgetLimits": 8, "bills": 6, "billSkips": 2 },
  "data": { "accounts": [], "categories": [], "transactions": [], "budgetLimits": [], "bills": [], "billSkips": [], "settings": [] }
}
```

**Backup:**
- Tombol "Backup sekarang". Jika `navigator.canShare({ files })` didukung, buka menu *share* (simpan ke Drive, kirim ke WhatsApp/email). Jika tidak, unduh file.
- Setelah berhasil, simpan `lastBackupAt`.
- Teks peringatan kecil: *"File backup berisi seluruh data keuangan Anda dan tidak dienkripsi. Simpan di tempat yang aman."*

**Pengingat:** banner dashboard muncul jika ada data **dan** (`lastBackupAt` kosong **atau** sudah > `backupReminderDays` hari) **dan** `lastDataChangeAt > lastBackupAt`. Teks: *"Backup terakhir 9 hari lalu · Backup sekarang"*. Banner bisa ditutup untuk hari itu.

**Restore:**
1. Pilih file.
2. Validasi: JSON valid, `app` cocok, `formatVersion`/`schemaVersion` didukung, setiap record lolos validasi tipe, dan integritas referensi terpenuhi (setiap `accountId`/`categoryId`/`billId` ada).
3. Tampilkan preview: tanggal backup, jumlah per tabel, dan rentang tanggal transaksi.
4. Peringatan: *"Semua data di perangkat ini akan DIGANTI dengan isi backup."* Sediakan tombol "Backup data saat ini dulu".
5. Konfirmasi memakai dialog di dalam aplikasi, bukan `window.confirm`.
6. Jika `schemaVersion` lebih lama, migrasikan di memori terlebih dahulu.
7. Hapus dan isi ulang semua tabel dalam **satu** `db.transaction`. Jika gagal, data lama tetap utuh.
8. Restore hanya bisa mengganti seluruh data. Penggabungan (merge) tidak didukung.

**Hapus semua data:** ada di Backup & Data, dengan konfirmasi mengetik kata `HAPUS`, lalu kembali ke onboarding.

## 9.13 Ekspor CSV (F-13)
- Rentang tanggal (default: semua).
- Kolom: `Tanggal;Jenis;Akun;Akun Tujuan;Kategori;Refund;Nominal;Catatan`.
- Pemisah titik koma (`;`), UTF-8 dengan BOM supaya langsung terbuka benar di Excel berbahasa Indonesia. Tanggal `YYYY-MM-DD` dan nominal integer tanpa format.
- Sel teks yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi prefiks `'` untuk mencegah formula injection.
- CSV **bukan** backup dan tidak bisa di-restore. Tampilkan keterangan ini di UI.

---

## 9.14 Target tabungan (v2.1)

**Model:** 1 target = 1 akun aset khusus (rekening terpisah atau *kantong* bank digital). **Progres = saldo akun itu**, sehingga uang tidak terhitung dua kali dan menabung cukup dicatat sebagai Transfer. Akun target otomatis **tidak** dihitung di Uang tersedia.

**Perhitungan** (`src/domain/goals.ts`), setoran dianggap terjadi sekali per bulan termasuk bulan berjalan:
| Angka | Rumus |
| --- | --- |
| Terkumpul | max(0, saldo akun target); progres = terkumpul ÷ target (maks. 100%) |
| Perlu per bulan | ⌈(target − terkumpul) ÷ sisa bulan⌉; sisa bulan = bulan ini s.d. bulan target; jika tenggat lewat → seluruh sisa |
| Status jadwal | Garis lurus dari (tanggal mulai, saldo awal) ke (akhir bulan target, target). Tertinggal jika kurang > 1% target, Lebih cepat jika lebih > 5% target, selain itu Sesuai jadwal; juga *Tercapai* dan *Lewat tenggat* |
| Rata-rata 3 bulan | Perubahan saldo bersih akun pada ≤ 3 bulan penuh terakhir sejak akun dibuka (setoran − penarikan ± penyesuaian nilai) |
| Proyeksi / simulasi | Bulan tercapai = bulan ini + ⌈sisa ÷ setoran per bulan⌉ − 1 |
| Saran Dana Darurat | Rata-rata pengeluaran 3 bulan penuh terakhir × 3/6/12 (default 6), dibulatkan ke atas ke Rp100.000 |

**Fitur:** kartu target (progres, status jadwal dengan ikon + teks), detail (kekurangan, perlu/bulan, rata-rata, proyeksi), tonggak 25/50/75/100% dengan pesan netral, simulasi dua arah, setoran rutin opsional sebagai tagihan Transfer bulanan "Nabung …" (s.d. bulan target) yang otomatis mengurangi Uang tersedia, template Dana Darurat, kartu di Beranda (maks. 2 target, tenggat terdekat), arsip/selesai (setoran rutin dinonaktifkan), hapus (setoran rutin ikut dihapus, atau dinonaktifkan jika sudah pernah dibayar; akun & transaksi tetap ada).

**Aturan:** pembuatan target (akun baru + target + tagihan setoran) atomik; akun yang dipakai target aktif tidak bisa diarsipkan/dihapus; akun target tidak bisa diganti setelah dibuat; backup v1 dimigrasikan otomatis (`goals: []`).

# 10. UI/UX

- Mobile-first, satu kolom, dan target sentuh ≥ 44px. Tombol [+] selalu terjangkau ibu jari.
- Warna: latar putih/abu muda, navy sebagai warna utama, hijau/amber/merah untuk status. Status **selalu** disertai teks atau ikon, tidak hanya warna.
- Nominal memakai angka tabular (`font-variant-numeric: tabular-nums`). Pengeluaran ditampilkan tanpa tanda minus dan memakai warna netral. Pemasukan diberi tanda `+` berwarna hijau.
- Utang ditampilkan dengan kata "terutang", bukan angka negatif.
- Tanpa animasi berlebihan. Empty state selalu memberi langkah berikutnya, misalnya *"Belum ada transaksi bulan ini. Ketuk + untuk mencatat."*
- Aksesibilitas: kontras WCAG 2.2 AA, label pada semua input dan tombol ikon, fokus terlihat, bisa dioperasikan dengan keyboard di desktop, dan grafik selalu disertai angka.
- Semua teks dalam Bahasa Indonesia dengan sapaan "Anda".

---

# 11. Kebutuhan Nonfungsional

| Area | Target |
| --- | --- |
| Offline | Setelah kunjungan pertama, seluruh fitur berjalan tanpa internet. |
| Performa | Dashboard tampil < 1 detik dengan 20.000 transaksi di HP kelas menengah. Interaksi form < 100 ms. Bundle awal < 300 KB gzip. |
| Integritas | Tidak ada tulis parsial (transaksi Dexie). Semua tes keuangan di §12 lulus sebelum rilis. |
| Privasi | Nol request jaringan saat runtime selain memuat aset aplikasi sendiri. Tanpa analytics, tanpa pihak ketiga. |
| Browser | Chrome Android (2 versi utama terakhir), Safari iOS 16.4+, Chrome/Edge/Firefox/Safari desktop terbaru. |
| Pemeliharaan | Logika domain memiliki cakupan tes ≥ 90%. Setiap versi skema punya fixture backup dan tes migrasi. |

---

# 12. Skenario Uji (tes otomatis Vitest, kecuali ditandai *manual*)

| ID | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| QA-01 | Pengeluaran Rp50.000 dari BCA | BCA −50.000; pengeluaran bulan & kategori +50.000 |
| QA-02 | Transfer Rp1.000.000 BCA → GoPay | BCA −1jt; GoPay +1jt; total kas & pengeluaran tetap |
| QA-03 | Transfer Rp1jt + biaya Rp2.500 | BCA −1.002.500; GoPay +1jt; pengeluaran +2.500 (Bunga & Biaya Admin) |
| QA-04 | Belanja kartu kredit 500rb lalu bayar penuh | Pengeluaran +500rb sekali; utang kartu kembali 0; BCA −500rb |
| QA-05 | Terima pinjaman 2jt | BCA +2jt; utang +2jt; pemasukan & kekayaan bersih tetap |
| QA-06 | Cicilan pokok 200rb + bunga 15rb | BCA −215rb; utang −200rb; pengeluaran +15rb |
| QA-07 | Edit nominal transaksi bulan lalu | Saldo, laporan bulan lalu, dan anggaran bulan lalu berubah sesuai |
| QA-08 | Simpan dua kali cepat | Hanya 1 transaksi |
| QA-09 | Saldo awal 3jt | Saldo 3jt; pemasukan tetap 0 |
| QA-10 | Refund 20rb kategori Makan | Akun +20rb; pengeluaran Makan −20rb; pemasukan tetap |
| QA-11 | Kategori tanpa anggaran / batas 0 | Tidak ada pembagian dengan nol; tampil "Belum ada anggaran" |
| QA-12 | Saldo aplikasi 1,2jt, saldo sebenarnya 1,15jt | Penyesuaian −50rb; saldo 1,15jt; pengeluaran tidak berubah |
| QA-13 | Kas 5jt; tagihan BCA bulan ini belum dibayar 1,5jt; tagihan BCA bulan lalu terlambat 300rb; tagihan via kartu kredit 100rb | Uang tersedia = 3.200.000 |
| QA-14 | Bayar tagihan → hapus pembayarannya → lewati | Status: Dibayar → Terlambat/Akan datang → Dilewati |
| QA-15 | Tagihan `dueDay` 31 di Februari 2027 | Jatuh tempo 28 Feb 2027 |
| QA-16 | Backup → hapus semua → restore | Semua tabel identik (deep equal); saldo identik |
| QA-17 | Restore file rusak / referensi hilang / `app` salah | Ditolak dengan pesan jelas; data lama utuh |
| QA-18 | Restore fixture `schemaVersion` lama | Migrasi benar; saldo sama dengan nilai yang diharapkan di fixture |
| QA-19 | Error dipaksa di tengah restore | Data lama utuh (rollback) |
| QA-20 | Transaksi dibuat pukul 23:30 WIB | `date` = tanggal lokal hari itu, bukan tanggal UTC |
| QA-21 | Tanggal besok; tanggal sebelum saldo awal | Keduanya ditolak dengan pesan |
| QA-22 | Arsipkan akun bersaldo Rp10.000 | Ditolak dengan saran Sesuaikan/Transfer |
| QA-23 | Catatan `=HYPERLINK(...)` diekspor ke CSV | Sel diawali `'` |
| QA-24 | Ubah batas anggaran bulan ini | Bulan lalu tetap memakai batas lama |
| QA-25 | Hapus transfer yang punya biaya tambahan | Transfer dan biaya terhapus bersamaan; undo mengembalikan keduanya |
| QA-26 | *manual* — Mode pesawat setelah install | Aplikasi terbuka dan bisa menyimpan transaksi |
| QA-27 | *manual* — Data 20.000 transaksi di HP kelas menengah | Dashboard < 1 detik |
| QA-28 | *manual* — Install di iPhone & Android, backup via share sheet, restore di perangkat lain | Berhasil dan data identik |
| QA-29 | Target 120 jt, terkumpul 30 jt, 12 bulan lagi | 25%; perlu Rp7.500.000/bulan; tonggak 25% |
| QA-30 | Buat target + akun baru + setoran rutin; satu bagian gagal validasi | Tidak ada yang tersimpan |
| QA-31 | Setoran rutin Rp X bulan ini dari BCA | Uang tersedia berkurang Rp X; akun target tidak masuk total kas |
| QA-32 | Pulihkan backup skema v1 | Berhasil; target kosong; data lain identik |

---

# 13. Risiko dan Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| **Data hilang** (HP rusak/hilang, browser dibersihkan, iOS menghapus data situs) | Pengingat backup, `storage.persist()`, panduan install PWA, peringatan di onboarding. |
| Alamat situs berubah sehingga data "hilang" | Alamat dikunci (§6.4); wajib backup sebelum migrasi alamat. |
| Bug migrasi skema merusak data | Fixture backup per versi + tes migrasi; migrasi dijalankan dalam transaksi. |
| File backup bocor (misalnya terkirim ke grup WhatsApp yang salah) | Peringatan di UI; backup terenkripsi di Fase 2. |
| Pengguna berhenti mencatat | Form ≤ 4 ketukan, default cerdas, fitur Sesuaikan saldo agar mudah "mulai lagi". |
| Saldo tidak cocok dengan bank | Fitur Sesuaikan saldo dan rincian setiap angka. |
| Scope melebar | Daftar "Tidak akan dikerjakan" (§4.3) dipegang ketat. |

---

# 14. Rencana Pembangunan

| Milestone | Isi | Selesai jika |
| --- | --- | --- |
| M1 — Fondasi | Setup proyek, skema Dexie, `src/domain` (saldo, laporan, anggaran, tagihan, validasi) | QA-01 s.d. QA-15, QA-20 s.d. QA-22, dan QA-24 lulus |
| M2 — Pencatatan | Onboarding, akun, kategori, form transaksi, riwayat & pencarian, Sesuaikan saldo | Bisa dipakai mencatat harian; QA-08 dan QA-25 lulus |
| M3 — Insight | Dashboard, anggaran, laporan, sembunyikan nominal | Semua angka bisa diketuk ke rinciannya |
| M4 — Tagihan | Tagihan rutin, Uang tersedia | QA-13 s.d. QA-15 lulus di UI |
| M5 — Data & PWA | Backup/restore, CSV, pengingat, install, offline, persist, banner update | QA-16 s.d. QA-19 dan QA-23 lulus |
| M6 — Rilis | Polish, aksesibilitas, deploy GitHub Pages, uji manual di HP keluarga | QA-26 s.d. QA-28 lulus |

---

# 15. Default Detail (final, disetujui 13 Okt 2026)

Semua default di bawah sudah ditinjau dan menjadi ketetapan MVP. Kolom alternatif dipertahankan sebagai referensi jika kelak perlu ditinjau ulang.

| # | Default | Alternatif |
| --- | --- | --- |
| D-1 | Kategori hanya satu tingkat | Subkategori (sudah di Fase 2) |
| D-2 | Jenis transaksi tidak bisa diubah setelah disimpan | Bisa diubah, tetapi logika edit jadi lebih rumit |
| D-3 | Transaksi bertanggal masa depan tidak diizinkan | Diizinkan dan dianggap terjadwal |
| D-4 | Arsip akun hanya jika saldo Rp0 | Arsip bebas, saldo tetap dihitung |
| D-5 | Ekspor CSV masuk MVP (pemisah `;`) | Ditunda |
| D-6 | File backup tidak dienkripsi di MVP | Enkripsi kata sandi di MVP |
| D-7 | Restore = ganti seluruh data, tanpa merge | Merge |
| D-8 | Ambang status anggaran tetap 80% | Bisa diatur |
| D-9 | Dashboard menampilkan tagihan ≤ 14 hari ke depan; Uang tersedia memakai horizon akhir bulan | Horizon lain |
| D-10 | Undo hapus berlaku 8 detik (5 detik terlalu cepat di HP); tanpa folder "Sampah" | Sampah 30 hari |
| D-11 | Tidak ada notifikasi apa pun; semua pengingat hanya muncul di dalam aplikasi | — (push butuh server) |

---

# 16. Glosarium (untuk tim; UI tidak memakai istilah teknis)

| Istilah | Arti |
| --- | --- |
| Akun Aset | Tempat uang yang Anda miliki: tunai, rekening, e-wallet. |
| Akun Utang | Kartu kredit, PayLater, pinjaman; saldonya = jumlah terutang. |
| Saldo natural | Saldo dari sudut pandang pengguna: dimiliki (aset) atau terutang (utang), selalu dibaca positif. |
| Uang tersedia | Kas dikurangi tagihan kas yang belum dibayar sampai akhir bulan. |
| Kekayaan bersih | Total aset − total utang. |
| Penyesuaian | Transaksi sistem untuk menyamakan saldo aplikasi dengan saldo sebenarnya. |
| Refund | Pengembalian dana yang mengurangi pengeluaran kategori asal, bukan pemasukan. |
| PWA | Aplikasi web yang bisa dipasang ke layar utama dan berjalan offline. |
| IndexedDB / Dexie | Database di dalam browser / library untuk mengaksesnya. |
| Origin | Alamat situs (`https://domain/`); data browser terikat padanya. |
