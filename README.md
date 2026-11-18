# Klinik HAP - Pencatatan Kunjungan Klinik Perusahaan

Aplikasi web sederhana untuk perawat/petugas klinik: catat kunjungan karyawan, lalu aplikasi otomatis
menyiapkan **dua email** (pekerja dan atasan/HRD) yang **dibuka dulu di Outlook** untuk diperiksa dan dikirim.

- Tanpa build, tanpa instalasi untuk pemakaian dasar (HTML + CSS + JavaScript murni, bisa offline).
- Data tersimpan di **localStorage browser laptop ini** (tidak dikirim ke server mana pun).
- Tampilan responsif untuk laptop dan tablet klinik.

## Fitur

| Fitur | Keterangan |
|---|---|
| Form kunjungan | NIK, nama, departemen, keluhan/diagnosa, obat, dokter pemeriksa, rekomendasi (Fit to Work / Istirahat Sakit / Rujukan), durasi istirahat |
| Waktu otomatis | Jam masuk terisi saat form mulai diisi, jam keluar saat disimpan; bisa diubah manual (centang "Ubah waktu secara manual") |
| No. surat otomatis | `SK/KLL/YYYYMMDD/XXX` (urut per hari; awalan dapat diubah di Pengaturan) |
| **Simpan & Kirim Notifikasi** | Menyimpan ke riwayat lalu menampilkan 2 draf email yang bisa disunting |
| Email 1 (Pekerja) | Ringkasan kunjungan, dokter, rekomendasi, info Surat Keterangan telah diserahkan di klinik |
| Email 2 (Atasan/HRD) | Nama, NIK, dept, jam masuk-keluar, status kerja, info surat. **Tanpa diagnosis, obat, maupun tujuan rujukan** |
| Footer kedua email | `Punya keluhan atau saran pengembangan layanan? Silakan input melalui https://s.id/klinikHAP` |
| Outlook | Per email: **Buka di Outlook (aplikasi)**, **Buka di Outlook Web**, atau **Unduh .eml** (terbuka di Outlook sebagai draf siap kirim) |
| Riwayat | Pencarian, filter, ringkasan harian, detail, buka ulang draf email, hapus, unduh CSV |
| Isi otomatis | NIK yang pernah tercatat mengisi nama/departemen/email otomatis |
| Cadangan | Unduh/pulihkan data (.json) di menu Pengaturan |

## Cara pakai di laptop

### Cara 1 - paling mudah (tanpa instalasi)
1. Unduh repo ini (`Code` > `Download ZIP`) lalu ekstrak, atau `git clone https://github.com/Rochiki/klinikhap`.
2. Klik dua kali **`index.html`** (disarankan Chrome atau Edge).
3. Buka menu **Pengaturan**: isi nama klinik, nama perawat, daftar dokter, dan dokter default. Simpan.

> Pada cara ini, tombol Outlook memakai `mailto:` (Outlook aplikasi yang menjadi aplikasi email bawaan Windows)
> atau Outlook Web. Alamat email tujuan harus diisi di form; bisa juga diubah langsung di draf.

### Cara 2 - lewat server lokal (opsional)
Butuh [Node.js](https://nodejs.org) 18 atau lebih baru.

```bash
npm install
npm start          # buka http://localhost:3000
```
Windows: setelah `npm install`, cukup klik dua kali `Jalankan-Klinik.bat`.

Server lokal hanya menyajikan berkas web dan, bila diaktifkan, tombol **Kirim Langsung (SMTP)**
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

**Logo:** letakkan berkas logo resmi di `img/logo.png`; otomatis tampil di pojok kiri atas.

## Struktur proyek

```
index.html            halaman aplikasi
css/style.css         tampilan
js/email.js           pembuat draf email, nomor surat, mailto, .eml (juga diuji di Node)
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
- Nomor surat dihitung per laptop. Bila dipakai di lebih dari satu laptop, awalan nomor sebaiknya dibedakan
  (misal `SK/KLL1`, `SK/KLL2`) agar tidak terjadi nomor kembar.
- Pemrosesan data kesehatan karyawan tunduk pada UU PDP; sesuaikan dengan kebijakan perusahaan.

## Pengujian

```bash
npm test
```
Menguji isi email (termasuk bahwa email atasan tidak membocorkan diagnosis), nomor surat, penyimpanan,
cadangan, dan server lokal.
