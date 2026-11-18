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
| Surat Keterangan Sakit | Hanya untuk **Istirahat Sakit**: nomor otomatis `SK/KLL/YYYYMMDD/XXX` (urut per hari; awalan dapat diubah). Fit to Work dan Rujukan tidak menerbitkan surat sakit |
| **Simpan & Kirim Notifikasi** | Menyimpan ke riwayat lalu menampilkan 2 draf email yang bisa disunting |
| Email 1 (Pekerja) | Ringkasan kunjungan, dokter, rekomendasi; untuk istirahat sakit, info Surat Keterangan Sakit telah diserahkan di klinik |
| Email 2 (Atasan/HRD) | Nama, NIK, dept, jam masuk-keluar, status kerja, info surat. **Tanpa diagnosis, obat, maupun tujuan rujukan** |
| Tanda tangan | `Best Regards, Eny Rohmatul Fitri, Perawat Perusahaan, PT Hexindo Adiperkasa Tbk` (dapat diubah di Pengaturan) |
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
- Nomor surat sakit dihitung per laptop. Bila dipakai di lebih dari satu laptop, awalan nomor sebaiknya dibedakan
  (misal `SK/KLL1`, `SK/KLL2`) agar tidak terjadi nomor kembar.
- Pemrosesan data kesehatan karyawan tunduk pada UU PDP; sesuaikan dengan kebijakan perusahaan.

## Pengujian

```bash
npm test
```
Menguji isi email (termasuk bahwa email atasan tidak membocorkan diagnosis), nomor surat, penyimpanan,
cadangan, dan server lokal.
