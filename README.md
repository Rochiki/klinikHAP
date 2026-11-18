# Klinik HAP - Pencatatan Kunjungan Klinik Perusahaan

Aplikasi web sederhana untuk perawat/petugas klinik: catat kunjungan karyawan, lalu aplikasi otomatis
menyiapkan **dua email** (pekerja dan atasan/HRD) yang **dibuka dulu di Outlook** untuk diperiksa dan dikirim.

- Tanpa build, tanpa instalasi untuk pemakaian dasar (HTML + CSS + JavaScript murni, bisa offline).
- Data tersimpan di **localStorage browser laptop ini** (tidak dikirim ke server mana pun).
- Tampilan responsif untuk laptop dan tablet klinik.

## Fitur

| Fitur | Keterangan |
|---|---|
| Form kunjungan | Status pasien, NIK, nama, departemen (pilih/ketik), diagnosis (pilih/ketik), keluhan, obat 1-5 + jumlah, dokter pemeriksa, rekomendasi (Fit to Work / Istirahat Sakit / Rujukan), durasi istirahat, dugaan terkait kerja, catatan |
| Waktu otomatis | Jam masuk terisi saat form mulai diisi, jam keluar saat disimpan; bisa diubah manual (centang "Ubah waktu secara manual") |
| Surat Keterangan Sakit (PDF) | Hanya untuk **Istirahat Sakit**. Nomor `007/SKS/QSHE-HAP/XI/2026` (urut per bulan; bagian tengah dapat diubah di Pengaturan). Kop logo Hexindo + alamat HO Pulokambing, tulisan "diterbitkan otomatis oleh sistem", nama dokter pemeriksa (+ No. SIP bila diisi), **kode QR + kode verifikasi**. Surat **tanpa diagnosis**, karena salinan yang sama dikirim ke pekerja, atasan, dan HC. PDF ikut terlampir otomatis pada Outlook Classic langsung, `.eml`, dan SMTP |
| Verifikasi surat | Di menu Riwayat: masukkan nomor + kode (atau tempel isi QR). Pengecekan dilakukan terhadap catatan di laptop klinik. QR berisi **tautan** ke halaman klinikHAP (bawaan `https://rochiki.github.io/klinikHAP/`, dapat diganti di Pengaturan; isi `-` untuk QR teks biasa), sehingga kamera ponsel membuka halaman, bukan mencari teks di Google. Tautan hanya memuat nomor surat, kode, dokter, waktu terbit, dan lama istirahat (tanpa nama, NIK, diagnosis). Di ponsel halaman menampilkan data itu (hanya baca); keaslian penuh tetap dicek di laptop klinik |
| Rekap Excel | Riwayat > **Unduh Rekap (.xlsx)**: tata letak sama dengan contoh `INPUT_KUNJUNGAN` (36 kolom, warna kuning/abu-abu, judul sama). Kolom abu-abu memakai rumus hidup yang sama dengan contoh, lengkap dengan dropdown, 2000 baris siap isi, dan lembar MASTER_DIAGNOSA / MASTER_OBAT / MASTER_MAP / INPUT_HEALTH_CORNER di dalam berkas (tanpa tautan luar). Obat baru otomatis masuk MASTER_OBAT. NIK + inisial saja, tanpa nama lengkap. Daftar acuan ada di `js/master.js` |
| Selesai | Bila server lokal aktif di Windows, tombol **Selesai & Buka Kedua Email di Outlook Classic** membuka kedua draf (dengan PDF) sekaligus |
| **Simpan & Kirim Notifikasi** | Menyimpan ke riwayat lalu menampilkan 2 draf email yang bisa disunting |
| Email 1 (Pekerja) | Ringkasan kunjungan, dokter, rekomendasi; untuk istirahat sakit, Surat Keterangan Sakit (PDF) terlampir |
| Email 2 (Atasan/HRD) | Nama, NIK, dept, jam masuk-keluar, status kerja, info surat. **Tanpa diagnosis, obat, maupun tujuan rujukan** |
| Bahasa email | Di dialog email ada pilihan **Bahasa Indonesia / English**. Isi, subjek, tanggal, dan footer ikut berganti; pilihan diingat untuk kunjungan berikutnya. Mengganti bahasa membuat ulang isi email (ada konfirmasi bila isi sudah Anda ubah) |
| Tanda tangan | `Best Regards, Eny Rohmatul Fitri, Perawat Perusahaan, PT Hexindo Adiperkasa Tbk` (dapat diubah di Pengaturan) |
| Link hidup | Email dikirim berformat HTML (lewat **Outlook Classic langsung**, **.eml**, atau SMTP) sehingga `https://s.id/klinikHAP` dapat diklik. Tombol `mailto` hanya bisa teks polos |
| Footer kedua email | `Punya keluhan atau saran pengembangan layanan? Silakan input melalui https://s.id/klinikHAP` |
| Outlook Classic | Per email: **Buka di Outlook Classic** (langsung, lewat `Jalankan-Klinik.bat`), **Unduh .eml** (terbuka di Outlook sebagai draf siap kirim), **mailto**, atau Outlook Web |
| Riwayat | Pencarian, filter, ringkasan harian, detail, buka ulang draf email, hapus, unduh CSV |
| Isi otomatis | NIK yang pernah tercatat mengisi nama/departemen/email otomatis |
| Cadangan | Unduh/pulihkan data (.json) di menu Pengaturan |

## Cara pakai di laptop

### Cara 1 - paling mudah (tanpa instalasi)
1. Unduh repo ini (`Code` > `Download ZIP`) lalu ekstrak, atau `git clone https://github.com/Rochiki/klinikhap`.
2. Klik dua kali **`index.html`** (disarankan Chrome atau Edge).
3. Buka menu **Pengaturan**: isi nama klinik, nama perawat, daftar dokter, dan dokter default. Simpan.

> Pada cara ini, email dibuka lewat **Unduh .eml** (paling andal: klik berkas yang terunduh, Outlook classic
> membukanya sebagai draf siap kirim) atau tombol `mailto` (butuh Outlook diatur sebagai aplikasi email bawaan Windows).
> Untuk membuka draf **langsung** di Outlook classic dengan satu klik, pakai Cara 2.

### Cara 2 - lewat server lokal (opsional)
Butuh [Node.js](https://nodejs.org) 18 atau lebih baru.

```bash
npm install
npm start          # buka http://localhost:3000
```
Windows: setelah `npm install`, cukup klik dua kali `Jalankan-Klinik.bat`.

Di Windows dengan **Outlook classic** terpasang, server ini menambah tombol **Buka di Outlook Classic**: draf lengkap
(penerima, CC, subjek, isi) langsung terbuka di Outlook desktop lewat PowerShell/COM, tanpa batas panjang `mailto`
dan tanpa perlu mengatur aplikasi email bawaan. Outlook tidak boleh dijalankan sebagai Administrator.
Server lokal juga menyediakan, bila diaktifkan, tombol **Kirim Langsung (SMTP)**
yang mengirim tanpa lewat Outlook. Untuk mengaktifkannya: salin `server/.env.example` menjadi `server/.env`,
isi SMTP perusahaan, lalu jalankan ulang. `server/.env` tidak ikut ke GitHub. Tanpa SMTP, tombol ini tersembunyi
dan alur Outlook tetap berjalan. Untuk mencoba tanpa mengirim apa pun, isi `MAIL_DRY_RUN=1`.

## Deploy ke GitHub

```bash
git add .
git commit -m "Aplikasi Klinik HAP"
git push origin main
```

**GitHub Pages (tanpa server):** `Settings` > `Pages` > `Source: Deploy from a branch` > `main` / `(root)`.
Aplikasi tersedia di `https://rochiki.github.io/klinikHAP/`. Data tetap tersimpan di browser masing-masing
pengguna; fitur Kirim Langsung (SMTP) tidak tersedia di Pages, sedangkan tombol Outlook tetap bekerja.
Karena repositori GitHub Pages bersifat publik (kecuali paket berbayar), jangan menaruh data pekerja di repo.

**Logo:** logo resmi Hexindo sudah terpasang (`img/logo.png` untuk tampilan, `js/logo-data.js` untuk PDF). Untuk menggantinya, unggah di Pengaturan > Logo untuk surat sakit.

## Struktur proyek

```
index.html            halaman aplikasi
css/style.css         tampilan
js/email.js           pembuat draf email, nomor surat, mailto, .eml + lampiran (juga diuji di Node)
js/master.js          daftar acuan: diagnosis/ICD-10, jenis obat, departemen -> kelompok kerja
js/recap.js, xlsx.js  rekap Excel format INPUT_KUNJUNGAN (penulis .xlsx tanpa dependensi)
js/surat.js, pdf.js   Surat Keterangan Sakit PDF, kode verifikasi, QR (js/vendor/qrcode.js, MIT)
js/store.js           penyimpanan localStorage, riwayat, cadangan
js/app.js             logika antarmuka
server/server.js      server lokal opsional (berkas web + SMTP lewat nodemailer)
server/.env.example   contoh konfigurasi SMTP
test/                 tes otomatis (npm test)
```

## Privasi & keamanan data

- Data kunjungan memuat **data kesehatan**. Pakai akun Windows terpisah/berkata sandi untuk laptop klinik,
  aktifkan BitLocker, dan batasi akses hanya untuk petugas klinik.
- Email atasan/HRD sengaja tidak memuat diagnosis, obat, atau tujuan rujukan. Periksa tetap draf sebelum mengirim.
- Email ke pekerja memuat diagnosis dan obat. Pastikan alamat tujuan benar (kolom Kepada dapat disunting).
- Unduh **cadangan** berkala; menghapus data browser akan menghapus riwayat. Simpan berkas cadangan di tempat aman.
- Nomor surat sakit dihitung per laptop. Bila dipakai di lebih dari satu laptop, bagian tengah nomor sebaiknya dibedakan
  (misal `SKS/QSHE-HAP1`) agar tidak terjadi nomor kembar.
- Repositori ini tidak berisi data pekerja. Jangan menaruh NIK, rekap, atau cadangan kunjungan ke dalam repo.
- Pemrosesan data kesehatan karyawan tunduk pada UU PDP; sesuaikan dengan kebijakan perusahaan.

## Pengujian

```bash
npm test
```
Menguji isi email (termasuk bahwa email atasan tidak membocorkan diagnosis), nomor surat, penyimpanan,
cadangan, dan server lokal.
