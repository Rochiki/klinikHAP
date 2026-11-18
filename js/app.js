/* Klinik HAP - antarmuka aplikasi. Tanpa dependensi, jalan langsung dari index.html. */
(function () {
  'use strict';

  var E = window.KlinikEmail;
  var S = window.KlinikStore;
  var pad = E.pad;

  var state = {
    manualTime: false, pristine: true, saved: false,
    canSend: false, dryRun: false, canOutlook: false, serverChecked: false,
    current: null, fromSubmit: false
  };

  var ROLES = [
    { key: 'worker', title: 'Email 1 · Untuk Pekerja', label: 'Pekerja' },
    { key: 'boss', title: 'Email 2 · Untuk Atasan / HRD', label: 'Atasan' }
  ];
  var MAILTO_MAX = 1800, OUTLOOK_WEB_MAX = 3500;
  var RECO_CLASS = { FIT: 'fit', SICK: 'sick', REFER: 'refer' };

  /* ---------- util DOM ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, props, children) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    (children || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function toLocalInput(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromLocalInput(s) { if (!s) return null; var d = new Date(s); return isNaN(d) ? null : d; }
  function unique(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) {
      x = String(x || '').trim();
      var k = x.toLowerCase();
      if (x && !seen[k]) { seen[k] = 1; out.push(x); }
    });
    return out;
  }
  function linesOf(text) { return unique(String(text || '').split(/\r?\n/)); }

  var toastTimer;
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    try { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); } catch (e) { /* tanpa popover */ }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.className = 'toast';
      try { if (t.matches(':popover-open')) t.hidePopover(); } catch (e) { /* abaikan */ }
    }, 3400);
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var host = document.querySelector('dialog[open]') || document.body;
      var ta = el('textarea', { 'aria-hidden': 'true' });
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      host.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* gagal */ }
      ta.remove();
      ok ? resolve() : reject(new Error('copy gagal'));
    });
  }
  function copyQuiet(t) { copyText(t).catch(function () { /* pengguna bisa pakai Salin Isi */ }); }
  function safeFile(s) { return String(s).replace(/[^A-Za-z0-9._-]+/g, '-'); }

  /* ---------- navigasi ---------- */
  function showView(name) {
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + name; });
    $$('.tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.view === name); });
    if (name === 'history') renderHistory();
    if (name === 'settings') loadSettingsForm();
    window.scrollTo(0, 0);
  }

  /* ---------- jam & waktu otomatis ---------- */
  function setAdmission(d) { $('#f-visitAt').value = toLocalInput(d); }
  function tick() {
    var now = new Date();
    $('#clock').textContent = E.fmtDate(now) + ' · ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (!state.manualTime) $('#f-checkOutAt').value = toLocalInput(now);
  }
  function setManualTime(on) {
    state.manualTime = on;
    $('#f-visitAt').readOnly = !on;
    $('#f-checkOutAt').readOnly = !on;
    if (!on) { $('#f-checkOutAt').value = toLocalInput(new Date()); }
  }

  /* ---------- form kunjungan ---------- */
  function form() { return $('#visitForm'); }
  function val(name) { var c = form().elements[name]; return c ? String(c.value || '').trim() : ''; }
  function currentReco() { var r = $('input[name="recommendation"]:checked', form()); return r ? r.value : ''; }

  function syncReco() {
    var r = currentReco();
    $('#restFields').hidden = r !== 'SICK';
    $('#referFields').hidden = r !== 'REFER';
    $('#suratHint').textContent = r === 'SICK' ? 'Surat Keterangan Sakit akan diterbitkan dengan nomor otomatis saat disimpan.'
      : (r ? 'Rekomendasi ini tidak menerbitkan surat sakit.' : '');
    updateRestPreview();
  }
  function updateRestPreview() {
    var box = $('#restPreview');
    if (currentReco() !== 'SICK') { box.textContent = ''; return; }
    var v = fromLocalInput(val('visitAt')) || new Date();
    var range = E.restRange({
      recommendation: 'SICK', restDays: val('restDays'), restStart: val('restStart'), visitAt: v.toISOString()
    });
    box.textContent = range ? 'Istirahat: ' + E.restText(range) : '';
  }

  function resetForm() {
    form().reset();
    clearErrors();
    $('#nikHint').textContent = ''; $('#nikHint').className = 'field-hint';
    state.pristine = true; state.saved = false;
    $('#manualTime').checked = false;
    setManualTime(false);
    var now = new Date();
    setAdmission(now);
    $('#f-checkOutAt').value = toLocalInput(now);
    $('#f-doctor').value = S.getSettings().defaultDoctor || '';
    syncReco();
  }

  function refreshLists() {
    var s = S.getSettings(), visits = S.listVisits();
    var depts = unique(s.departments.concat(visits.map(function (v) { return v.dept; })))
      .sort(function (a, b) { return a.localeCompare(b, 'id'); });
    var doctors = unique(s.doctors.concat(s.defaultDoctor ? [s.defaultDoctor] : []));
    function fill(id, items) {
      var dl = $(id); dl.textContent = '';
      items.forEach(function (x) { dl.appendChild(el('option', { value: x })); });
    }
    fill('#deptList', depts);
    fill('#doctorList', doctors);
    $('#clinicTitle').textContent = s.clinicName || 'Klinik HAP';
    document.title = (s.clinicName || 'Klinik HAP') + ' - Pencatatan Kunjungan';
    $('#historyCount').textContent = String(visits.length);
  }

  /* isi otomatis dari kunjungan sebelumnya berdasarkan NIK */
  function onNikChange() {
    var nik = val('nik'), hint = $('#nikHint');
    var hit = nik ? S.lookupWorker(nik) : null;
    if (!hit) { hint.textContent = ''; hint.className = 'field-hint'; return; }
    var filled = false;
    ['name', 'dept', 'workerEmail', 'supervisorName', 'supervisorEmail', 'hrdEmail'].forEach(function (f) {
      var c = form().elements[f];
      if (c && !c.value.trim() && hit[f]) { c.value = hit[f]; filled = true; }
    });
    if (filled) {
      hint.textContent = 'Data pekerja terisi dari kunjungan sebelumnya. Mohon periksa kembali.';
      hint.className = 'field-hint ok';
    }
  }

  /* ---------- validasi ---------- */
  function clearErrors() {
    $$('[data-error-for]').forEach(function (p) { p.textContent = ''; });
    $$('[aria-invalid]', form()).forEach(function (c) { c.removeAttribute('aria-invalid'); });
  }
  function showErrors(errs, root) {
    root = root || document;
    var first = null;
    $$('[data-error-for]', root).forEach(function (p) {
      var name = p.dataset.errorFor, msg = errs[name] || '';
      p.textContent = msg;
      var ctl = $('[name="' + name + '"]', root);
      if (ctl) { if (msg) ctl.setAttribute('aria-invalid', 'true'); else ctl.removeAttribute('aria-invalid'); }
      if (msg && !first) first = ctl;
    });
    if (first) { first.focus(); try { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* abaikan */ } }
  }
  function checkEmails(str) { return E.splitEmails(str).every(E.isEmail); }

  function validate(v, visitAt, outAt) {
    var e = {};
    if (!v.nik) e.nik = 'NIK wajib diisi.';
    else if (!/^[A-Za-z0-9._\-\/]+$/.test(v.nik)) e.nik = 'NIK hanya boleh berisi huruf, angka, dan tanda - . / _';
    if (!v.name) e.name = 'Nama pekerja wajib diisi.';
    if (!v.dept) e.dept = 'Departemen wajib diisi.';
    if (!v.doctor) e.doctor = 'Dokter pemeriksa wajib diisi (atur dokter default di menu Pengaturan).';
    if (!v.complaint) e.complaint = 'Keluhan / diagnosa wajib diisi.';
    if (!v.recommendation) e.recommendation = 'Pilih salah satu rekomendasi medis.';
    if (v.workerEmail && !E.isEmail(v.workerEmail)) e.workerEmail = 'Format email tidak valid.';
    if (v.supervisorEmail && !E.isEmail(v.supervisorEmail)) e.supervisorEmail = 'Format email tidak valid.';
    if (v.hrdEmail && !checkEmails(v.hrdEmail)) e.hrdEmail = 'Ada email HRD yang formatnya tidak valid.';
    if (v.recommendation === 'SICK') {
      var d = Number(v.restDays);
      if (!v.restDays || !Number.isInteger(d) || d < 1 || d > 30) e.restDays = 'Isi durasi istirahat 1 - 30 hari (bilangan bulat).';
    }
    if (!visitAt) e.visitAt = 'Jam masuk tidak valid.';
    if (state.manualTime && !outAt) e.checkOutAt = 'Jam keluar tidak valid.';
    else if (visitAt && outAt && outAt < visitAt) e.checkOutAt = 'Jam keluar tidak boleh lebih awal dari jam masuk.';
    return e;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var now = new Date();
    var vals = {
      name: val('name'), nik: val('nik'), dept: val('dept'),
      workerEmail: val('workerEmail'), supervisorName: val('supervisorName'),
      supervisorEmail: val('supervisorEmail'), hrdEmail: val('hrdEmail'),
      doctor: val('doctor'), complaint: val('complaint'), medications: val('medications'),
      recommendation: currentReco(),
      restDays: val('restDays'), restStart: val('restStart'), referralTo: val('referralTo')
    };
    var visitAt = fromLocalInput(val('visitAt'));
    var outAt = state.manualTime ? fromLocalInput(val('checkOutAt')) : now;
    var errs = validate(vals, visitAt, outAt);
    if (Object.keys(errs).length) { showErrors(errs, form()); toast('Mohon lengkapi isian yang ditandai.', true); return; }
    clearErrors();

    var settings = S.getSettings();
    var visit;
    try {
      // surat keterangan hanya diterbitkan untuk istirahat sakit
      var suratNo = '';
      if (vals.recommendation === 'SICK') suratNo = E.buildSuratNo(settings.suratPrefix, visitAt, S.nextSeq(settings.suratPrefix, E.ymd(visitAt)));
      visit = {
        suratNo: suratNo,
        createdAt: now.toISOString(), visitAt: visitAt.toISOString(), checkOutAt: outAt.toISOString(),
        name: vals.name, nik: vals.nik, dept: vals.dept,
        workerEmail: vals.workerEmail, supervisorName: vals.supervisorName,
        supervisorEmail: vals.supervisorEmail, hrdEmail: vals.hrdEmail,
        doctor: vals.doctor, nurse: settings.nurseName || '',
        complaint: vals.complaint, medications: vals.medications,
        recommendation: vals.recommendation,
        restDays: vals.recommendation === 'SICK' ? Number(vals.restDays) : 0,
        restStart: vals.recommendation === 'SICK' ? vals.restStart : '',
        referralTo: vals.recommendation === 'REFER' ? vals.referralTo : '',
        emailStatus: { worker: false, boss: false }
      };
      S.addVisit(visit);
      S.rememberWorker(visit);
    } catch (e) {
      toast('Gagal menyimpan: penyimpanan browser penuh atau diblokir.', true);
      return;
    }
    state.saved = true;
    refreshLists();
    openEmailDialog(visit, true);
  }

  /* ---------- dialog email ---------- */
  function openEmailDialog(visit, fromSubmit) {
    state.current = visit; state.fromSubmit = fromSubmit;
    var lang = E.normLang(S.getSettings().emailLang);
    var mails = E.buildEmails(visit, S.getSettings(), lang);
    setLangUi(lang);
    var grid = $('#emailGrid'); grid.textContent = '';
    ROLES.forEach(function (r) {
      var card = $('#tplEmailCard').content.firstElementChild.cloneNode(true);
      card.dataset.role = r.key;
      $('h3', card).textContent = r.title;
      ['to', 'cc', 'subject', 'body'].forEach(function (f) {
        var input = $('[data-f="' + f + '"]', card);
        input.value = mails[r.key][f];
        if (f === 'subject' || f === 'body') input.dataset.gen = mails[r.key][f]; // untuk deteksi suntingan manual
        var id = 'em-' + r.key + '-' + f;
        input.id = id;
        input.closest('.field').querySelector('label').setAttribute('for', id);
      });
      $('[data-action="send"]', card).hidden = !state.canSend;
      $('[data-action="outlook-com"]', card).hidden = !state.canOutlook;
      $('[data-f="to"]', card).addEventListener('input', function () { updateCard(card); });
      grid.appendChild(card);
      updateCard(card);
    });
    var banner = $('#emailBanner');
    banner.textContent = '';
    banner.appendChild(document.createTextNode(visit.suratNo
      ? 'Data kunjungan tersimpan. No. Surat Keterangan Sakit: '
      : 'Data kunjungan tersimpan. Tidak ada surat sakit untuk rekomendasi ini.'));
    if (visit.suratNo) banner.appendChild(el('strong', { id: 'dlgSuratNo', text: visit.suratNo }));
    banner.hidden = !fromSubmit;
    $('#emailDlgSub').textContent = visit.name + ' (' + visit.nik + ') · ' + E.fmtDate(new Date(visit.visitAt));
    $('#mailNote').textContent = fromSubmit
      ? 'Buka tiap email di Outlook, periksa, lalu tekan Kirim di Outlook. Draf dapat dibuka lagi dari menu Riwayat.'
      : 'Buka tiap email di Outlook, periksa, lalu tekan Kirim di Outlook.';
    var dlg = $('#emailDialog');
    if (!dlg.open) dlg.showModal();
    $('#emailDialog .email-card .btn.primary').focus({ preventScroll: true });
    $('#emailDialog .dlg-body').scrollTop = 0;
  }

  function setLangUi(lang) {
    $$('#langSeg [data-lang]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.lang === lang ? 'true' : 'false'); });
  }
  function switchLang(lang) {
    lang = E.normLang(lang);
    if (lang === E.normLang(S.getSettings().emailLang)) return;
    var cards = $$('#emailGrid .email-card');
    var edited = cards.some(function (c) {
      return ['subject', 'body'].some(function (f) { var i = $('[data-f="' + f + '"]', c); return i.value !== i.dataset.gen; });
    });
    if (edited && !window.confirm('Isi email sudah Anda ubah. Ganti bahasa akan membuat ulang isi email dan menghapus perubahan tersebut. Lanjutkan?')) return;
    S.saveSettings({ emailLang: lang });
    var mails = E.buildEmails(state.current, S.getSettings(), lang);
    cards.forEach(function (c) {
      ['subject', 'body'].forEach(function (f) {
        var i = $('[data-f="' + f + '"]', c);
        i.value = mails[c.dataset.role][f]; i.dataset.gen = i.value;
      });
    });
    setLangUi(lang);
    toast(lang === 'en' ? 'Email diganti ke English.' : 'Email diganti ke Bahasa Indonesia.');
  }

  function updateCard(card) {
    var visit = state.current, role = card.dataset.role;
    var sent = !!(visit.emailStatus && visit.emailStatus[role]);
    var badge = $('[data-f="status"]', card);
    var opened = !!(visit.emailOpened && visit.emailOpened[role]);
    badge.textContent = sent ? 'Sudah terkirim' : (opened ? 'Dibuka di Outlook' : 'Belum dibuka');
    badge.className = 'badge' + (sent ? ' sent' : (opened ? ' opened' : ''));
    var mark = $('[data-action="mark"]', card);
    mark.textContent = sent ? 'Terkirim (klik untuk batalkan)' : 'Tandai Sudah Terkirim';
    mark.classList.toggle('is-done', sent);
    var hint = $('[data-f="hint"]', card), to = $('[data-f="to"]', card).value.trim();
    var msg = '';
    if (!to) msg = 'Alamat email tujuan belum diisi. Isi kolom Kepada, atau gunakan Salin Isi / Unduh .eml.';
    else if (!E.splitEmails(to).every(E.isEmail)) msg = 'Ada alamat email tujuan yang formatnya tidak valid.';
    hint.textContent = msg; hint.hidden = !msg;
  }
  function readCard(card) {
    var o = {};
    ['to', 'cc', 'subject', 'body'].forEach(function (f) { o[f] = $('[data-f="' + f + '"]', card).value; });
    o.to = E.splitEmails(o.to).join(','); o.cc = E.splitEmails(o.cc).join(',');
    o.html = E.toHtml(o.body);
    return o;
  }
  function setOpened(role) {
    var v = state.current;
    v.emailOpened = Object.assign({ worker: false, boss: false }, v.emailOpened);
    v.emailOpened[role] = true;
    S.updateVisit(v.id, { emailOpened: v.emailOpened });
    $$('#emailGrid .email-card').forEach(updateCard);
  }
  function setSent(role, sent) {
    var v = state.current;
    v.emailStatus = Object.assign({ worker: false, boss: false }, v.emailStatus);
    v.emailStatus[role] = sent;
    S.updateVisit(v.id, { emailStatus: v.emailStatus });
    $$('#emailGrid .email-card').forEach(updateCard);
  }

  function onEmailAction(ev) {
    var btn = ev.target.closest('[data-action]');
    if (!btn) return;
    var card = btn.closest('.email-card'), role = card.dataset.role, m = readCard(card);
    var v = state.current;
    switch (btn.dataset.action) {
      case 'mailto':
        // Windows menolak link mailto > ~2000 karakter; bila terlalu panjang, isi disalin ke clipboard
        var url = E.mailtoUrl(m), long = url.length > MAILTO_MAX;
        if (long) { url = E.mailtoUrl({ to: m.to, cc: m.cc, subject: m.subject, body: '' }); copyQuiet(m.body); }
        var a = el('a', { href: url }); document.body.appendChild(a); a.click(); a.remove();
        setOpened(role);
        toast(long
          ? 'Isi email panjang, jadi sudah DISALIN. Di Outlook klik badan email lalu tekan Ctrl+V.'
          : 'Membuka Outlook... Bila tidak muncul, lihat "Tidak terbuka di Outlook?" di bawah.');
        break;
      case 'outlook':
        var host = 'https://outlook.office.com/mail/deeplink/compose?';
        var qs = function (withBody) {
          var q = ['to=' + encodeURIComponent(m.to), 'subject=' + encodeURIComponent(m.subject)];
          if (m.cc) q.splice(1, 0, 'cc=' + encodeURIComponent(m.cc));
          if (withBody) q.push('body=' + encodeURIComponent(m.body.replace(/\r?\n/g, '\r\n')));
          return q.join('&');
        };
        var web = host + qs(true), webLong = web.length > OUTLOOK_WEB_MAX;
        if (webLong) { web = host + qs(false); copyQuiet(m.body); }
        var w = window.open(web, '_blank', 'noopener');
        setOpened(role);
        toast(w === null && !webLong && window.__calls === undefined
          ? 'Jendela Outlook Web diblokir browser. Izinkan pop-up untuk halaman ini lalu klik lagi.'
          : (webLong ? 'Isi email panjang, jadi sudah DISALIN. Di Outlook Web klik badan email lalu tekan Ctrl+V.'
            : 'Membuka Outlook Web. Bila diminta, masuk dengan akun email kantor.'));
        break;
      case 'outlook-com':
        btn.disabled = true;
        fetch('api/outlook', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: m.to, cc: m.cc, subject: m.subject, text: m.body, html: m.html })
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
          .then(function (res) {
            if (res.ok) { setOpened(role); toast('Draf dibuka di Outlook. Periksa, lalu tekan Kirim di Outlook.'); }
            else toast(res.j.error || 'Gagal membuka Outlook. Coba Unduh .eml.', true);
          }).catch(function () { toast('Server lokal tidak dapat dihubungi. Coba Unduh .eml.', true); })
          .then(function () { btn.disabled = false; });
        break;
      case 'copy-body':
        copyText(m.body).then(function () { toast('Isi email disalin.'); }, function () { toast('Gagal menyalin. Pilih teks lalu tekan Ctrl+C.', true); });
        break;
      case 'copy-subject':
        copyText(m.subject).then(function () { toast('Subjek disalin.'); }, function () { toast('Gagal menyalin.', true); });
        break;
      case 'eml':
        download('email-' + (role === 'worker' ? 'pekerja' : 'atasan') + '-' + safeFile(v.suratNo || (E.ymd(new Date(v.visitAt)) + '-' + v.nik)) + '.eml', E.toEml(m), 'message/rfc822');
        setOpened(role);
        toast('File .eml diunduh. Klik dua kali, Outlook membukanya sebagai draf siap kirim.');
        break;
      case 'mark':
        setSent(role, !(v.emailStatus && v.emailStatus[role]));
        break;
      case 'send':
        sendViaServer(btn, role, m);
        break;
    }
  }

  function sendViaServer(btn, role, m) {
    if (!m.to || !m.to.split(',').every(E.isEmail)) { toast('Isi alamat email tujuan yang valid dulu.', true); return; }
    btn.disabled = true;
    var old = btn.textContent; btn.textContent = 'Mengirim...';
    fetch('api/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: m.to, cc: m.cc, subject: m.subject, text: m.body, html: m.html })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; });
    }).then(function (res) {
      if (res.ok) {
        if (state.dryRun) toast('Mode uji: email TIDAK benar-benar dikirim.');
        else { setSent(role, true); toast('Email terkirim ke ' + m.to + '.'); }
      } else toast(res.j.error || 'Gagal mengirim email.', true);
    }).catch(function () {
      toast('Server pengirim tidak dapat dihubungi.', true);
    }).then(function () { btn.disabled = false; btn.textContent = old; });
  }

  /* ---------- riwayat ---------- */
  function recoBadge(v) {
    var r = E.RECOMMENDATIONS[v.recommendation] || { short: '-' };
    var b = el('span', { class: 'badge ' + (RECO_CLASS[v.recommendation] || ''), text: r.short });
    var box = el('div', {}, [b]);
    if (v.recommendation === 'SICK') box.appendChild(el('small', { text: v.restDays + ' hari' }));
    return box;
  }
  function mailFlags(v) {
    var s = v.emailStatus || {};
    return el('div', { class: 'mail-flags' }, ROLES.map(function (r) {
      return el('span', {
        class: 'badge' + (s[r.key] ? ' sent' : ''), text: r.label + (s[r.key] ? ' ✓' : ''),
        title: r.label + (s[r.key] ? ': sudah terkirim' : ': belum ditandai terkirim')
      });
    }));
  }

  function filteredVisits() {
    var q = $('#hSearch').value.trim().toLowerCase(), reco = $('#hReco').value;
    var from = $('#hFrom').value.replace(/-/g, ''), to = $('#hTo').value.replace(/-/g, '');
    return S.listVisits().filter(function (v) {
      var day = E.ymd(new Date(v.visitAt));
      if (reco && v.recommendation !== reco) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return [v.name, v.nik, v.dept, v.suratNo, v.complaint, v.doctor].join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderStats(all) {
    var today = E.ymd(new Date());
    var t = all.filter(function (v) { return E.ymd(new Date(v.visitAt)) === today; });
    var items = [
      [t.length, 'Kunjungan hari ini'],
      [t.filter(function (v) { return v.recommendation === 'SICK'; }).length, 'Istirahat sakit hari ini'],
      [t.filter(function (v) { return v.recommendation === 'REFER'; }).length, 'Rujukan hari ini'],
      [all.length, 'Total kunjungan tercatat']
    ];
    var box = $('#stats'); box.textContent = '';
    items.forEach(function (i) { box.appendChild(el('div', { class: 'stat' }, [el('b', { text: String(i[0]) }), el('span', { text: i[1] })])); });
  }

  function renderHistory() {
    renderStats(S.listVisits());
    var rows = filteredVisits(), body = $('#historyBody');
    body.textContent = '';
    rows.forEach(function (v) {
      var d = new Date(v.visitAt);
      var tr = el('tr', { 'data-id': v.id }, [
        el('td', {}, [E.fmtDateShort(d), el('small', { text: E.fmtTime(d) + (v.checkOutAt ? ' - ' + E.fmtTime(new Date(v.checkOutAt)) : '') })]),
        el('td', { class: 'small', text: v.suratNo || '-' }),
        el('td', {}, [el('strong', { text: v.name }), el('small', { text: 'NIK ' + v.nik })]),
        el('td', { text: v.dept }),
        el('td', {}, [recoBadge(v)]),
        el('td', {}, [mailFlags(v)]),
        el('td', { class: 'right' }, [
          el('button', { type: 'button', class: 'btn small', 'data-act': 'detail', text: 'Detail' }), ' ',
          el('button', { type: 'button', class: 'btn small', 'data-act': 'emails', text: 'Email' }), ' ',
          el('button', { type: 'button', class: 'btn small danger', 'data-act': 'delete', text: 'Hapus' })
        ])
      ]);
      body.appendChild(tr);
    });
    $('#historyEmpty').hidden = rows.length > 0;
    $('#historyCount').textContent = String(S.listVisits().length);
  }

  function findVisit(id) { return S.listVisits().filter(function (v) { return v.id === id; })[0]; }

  function onHistoryClick(ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn) return;
    var id = btn.closest('tr').dataset.id, v = findVisit(id);
    if (!v) return;
    if (btn.dataset.act === 'detail') openDetail(v);
    else if (btn.dataset.act === 'emails') openEmailDialog(v, false);
    else if (btn.dataset.act === 'delete') {
      if (window.confirm('Hapus kunjungan ' + v.name + ' (' + (v.suratNo || E.fmtDateShort(new Date(v.visitAt))) + ')?\nTindakan ini tidak dapat dibatalkan.')) {
        S.deleteVisit(id); refreshLists(); renderHistory(); toast('Kunjungan dihapus.');
      }
    }
  }

  function openDetail(v) {
    var range = E.restRange(v), body = $('#detailBody');
    body.textContent = '';
    var d = new Date(v.visitAt);
    var rows = [
      ['No. Surat Sakit', v.suratNo || '-'],
      ['Tanggal', E.fmtDate(d)],
      ['Jam masuk - keluar', E.fmtTime(d) + (v.checkOutAt ? ' - ' + E.fmtTime(new Date(v.checkOutAt)) : '')],
      ['Nama', v.name], ['NIK', v.nik], ['Departemen', v.dept],
      ['Email pekerja', v.workerEmail || '-'],
      ['Atasan', [v.supervisorName, v.supervisorEmail].filter(Boolean).join(' - ') || '-'],
      ['Email HRD', v.hrdEmail || '-'],
      ['Dokter pemeriksa', v.doctor || '-'],
      ['Petugas', v.nurse || '-'],
      ['Keluhan / diagnosa', v.complaint],
      ['Obat diresepkan', v.medications || '-'],
      ['Rekomendasi', (E.RECOMMENDATIONS[v.recommendation] || { label: '-' }).label]
    ];
    if (range) rows.push(['Durasi istirahat', E.restText(range)]);
    if (v.referralTo) rows.push(['Tujuan rujukan', v.referralTo]);
    rows.forEach(function (r) { body.appendChild(el('dt', { text: r[0] })); body.appendChild(el('dd', { text: r[1] })); });
    $('#detailSub').textContent = v.name + ' (' + v.nik + ')';
    $('#detailDialog').dataset.id = v.id;
    $('#detailDialog').showModal();
  }

  /* ---------- ekspor CSV (pemisah titik koma agar rapi di Excel Indonesia) ---------- */
  function csvCell(x, textDigits) {
    var s = String(x === undefined || x === null ? '' : x);
    if (textDigits && /^\d+$/.test(s) && s.charAt(0) === '0') return '="' + s + '"'; // pertahankan nol di depan
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;                                       // cegah injeksi rumus
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportCsv() {
    var rows = filteredVisits();
    if (!rows.length) { toast('Tidak ada data untuk diunduh.', true); return; }
    var head = ['No. Surat', 'Tanggal', 'Jam Masuk', 'Jam Keluar', 'Nama', 'NIK', 'Departemen', 'Dokter', 'Petugas',
      'Keluhan/Diagnosa', 'Obat', 'Rekomendasi', 'Durasi Istirahat (hari)', 'Mulai Istirahat', 'Selesai Istirahat',
      'Tujuan Rujukan', 'Email Pekerja', 'Email Atasan', 'Email HRD', 'Email Pekerja Terkirim', 'Email Atasan Terkirim'];
    function dmy(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
    var out = [head.map(function (h) { return csvCell(h); }).join(';')];
    rows.slice().reverse().forEach(function (v) {
      var d = new Date(v.visitAt), r = E.restRange(v), s = v.emailStatus || {};
      out.push([
        v.suratNo, dmy(d), E.fmtTime(d), v.checkOutAt ? E.fmtTime(new Date(v.checkOutAt)) : '',
        v.name, v.nik, v.dept, v.doctor, v.nurse, v.complaint, String(v.medications || '').replace(/\r?\n/g, ' | '),
        (E.RECOMMENDATIONS[v.recommendation] || { label: '' }).label, r ? r.days : '', r ? dmy(r.start) : '', r ? dmy(r.end) : '',
        v.referralTo, v.workerEmail, v.supervisorEmail, v.hrdEmail, s.worker ? 'Ya' : 'Belum', s.boss ? 'Ya' : 'Belum'
      ].map(function (c, i) { return csvCell(c, i === 5); }).join(';'));
    });
    download('riwayat-klinik-' + E.ymd(new Date()) + '.csv', '﻿' + out.join('\r\n'), 'text/csv;charset=utf-8');
    toast(rows.length + ' kunjungan diunduh.');
  }

  /* ---------- pengaturan ---------- */
  function loadSettingsForm() {
    var s = S.getSettings(), f = $('#settingsForm');
    f.elements.clinicName.value = s.clinicName;
    f.elements.nurseName.value = s.nurseName;
    f.elements.nurseTitle.value = s.nurseTitle;
    f.elements.companyName.value = s.companyName;
    f.elements.doctors.value = s.doctors.join('\n');
    f.elements.defaultDoctor.value = s.defaultDoctor;
    f.elements.suratPrefix.value = s.suratPrefix;
    f.elements.ccAlways.value = s.ccAlways;
    f.elements.departments.value = s.departments.join('\n');
    updateSuratExample();
    $('#storageSize').textContent = Math.max(1, Math.round(S.approxBytes() / 1024)) + ' KB';
    updateServerStatus();
    showErrors({}, f);
  }
  function updateSuratExample() {
    var p = $('#settingsForm').elements.suratPrefix.value.trim() || 'SK/KLL';
    $('#suratExample').textContent = E.buildSuratNo(p, new Date(), 1);
  }
  function onSettingsSubmit(ev) {
    ev.preventDefault();
    var f = $('#settingsForm'), errs = {};
    var prefix = f.elements.suratPrefix.value.trim();
    var cc = f.elements.ccAlways.value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9\/_-]{0,28}$/.test(prefix)) errs.suratPrefix = 'Gunakan huruf, angka, / - _ (maks. 29 karakter), contoh: SK/KLL.';
    if (cc && !checkEmails(cc)) errs.ccAlways = 'Ada email CC yang formatnya tidak valid.';
    if (Object.keys(errs).length) { showErrors(errs, f); return; }
    showErrors({}, f);
    var doctors = linesOf(f.elements.doctors.value), def = f.elements.defaultDoctor.value.trim();
    S.saveSettings({
      clinicName: f.elements.clinicName.value.trim() || 'Klinik HAP',
      nurseName: f.elements.nurseName.value.trim(),
      nurseTitle: f.elements.nurseTitle.value.trim(),
      companyName: f.elements.companyName.value.trim(),
      doctors: doctors, defaultDoctor: def || doctors[0] || '',
      suratPrefix: prefix, ccAlways: E.splitEmails(cc).join(', '),
      departments: linesOf(f.elements.departments.value)
    });
    refreshLists();
    if (state.pristine) $('#f-doctor').value = S.getSettings().defaultDoctor || '';
    loadSettingsForm();
    toast('Pengaturan disimpan.');
  }

  function updateServerStatus() {
    var box = $('#serverStatus');
    if (!state.serverChecked) { box.textContent = ''; return; }
    if (state.canSend && state.dryRun) box.textContent = 'Server lokal aktif dalam MODE UJI: tombol Kirim Langsung tidak benar-benar mengirim email.';
    else if (state.canSend) box.textContent = 'Pengiriman email langsung (SMTP) aktif lewat server lokal.';
    else if (state.canOutlook) box.textContent = 'Tombol "Buka di Outlook Classic" aktif: draf email dibuka langsung di Outlook desktop.';
    else box.textContent = 'Email dibuka dulu di Outlook (aplikasi atau Outlook Web) lalu dikirim dari sana. Kirim Langsung (SMTP) tidak aktif.';
  }
  function detectServer() {
    if (location.protocol === 'file:' || !window.fetch) { state.serverChecked = true; updateServerStatus(); return; }
    fetch('api/health', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.ok) { state.canSend = !!j.canSend; state.dryRun = !!j.dryRun; state.canOutlook = !!j.canOutlook; }
    }).catch(function () { /* hosting statis: tanpa server */ }).then(function () {
      state.serverChecked = true; updateServerStatus();
    });
  }

  function onRestore(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var res = S.importAll(JSON.parse(String(rd.result)));
        refreshLists(); loadSettingsForm();
        toast(res.added + ' kunjungan dipulihkan, ' + res.skipped + ' dilewati (sudah ada/tidak valid).');
      } catch (e) { toast(e.message || 'Berkas cadangan tidak valid.', true); }
    };
    rd.readAsText(file);
  }

  /* ---------- inisialisasi ---------- */
  function init() {
    if (!S.isPersistent) $('#storageWarning').hidden = false;

    // logo opsional: letakkan berkas resmi di img/logo.png (tidak dibuatkan otomatis)
    var img = new Image();
    img.alt = 'Logo';
    img.onload = function () { $('#brandLogo').appendChild(img); $('#brandLogo').hidden = false; };
    img.src = 'img/logo.png';

    $$('.tab').forEach(function (t) { t.addEventListener('click', function () { showView(t.dataset.view); }); });

    form().addEventListener('submit', onSubmit);
    form().addEventListener('input', function (ev) {
      if (ev.target.id !== 'manualTime') state.pristine = false;
      var n = ev.target.name;
      if (n) {
        var p = $('[data-error-for="' + n + '"]');
        if (p) p.textContent = '';
        ev.target.removeAttribute('aria-invalid');
      }
      if (n === 'restDays' || n === 'restStart') updateRestPreview();
    });
    form().addEventListener('change', function (ev) {
      if (ev.target.name === 'recommendation') {
        var p = $('[data-error-for="recommendation"]'); p.textContent = '';
        syncReco();
      }
    });
    // jam masuk = saat petugas mulai mengisi (bukan saat halaman dibuka berjam-jam lalu)
    $('#f-nik').addEventListener('focus', function () {
      if (state.pristine && !state.manualTime) setAdmission(new Date());
    });
    $('#f-nik').addEventListener('change', onNikChange);
    $('#manualTime').addEventListener('change', function (ev) { setManualTime(ev.target.checked); });
    $('#f-visitAt').addEventListener('change', updateRestPreview);
    $$('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        $('#f-restDays').value = c.dataset.days; state.pristine = false;
        $('[data-error-for="restDays"]').textContent = '';
        $('#f-restDays').removeAttribute('aria-invalid');
        updateRestPreview();
      });
    });
    $('#btnReset').addEventListener('click', function () {
      if (state.pristine || window.confirm('Kosongkan semua isian form ini?')) resetForm();
    });

    $('#emailGrid').addEventListener('click', onEmailAction);
    $('#langSeg').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-lang]');
      if (b && state.current) switchLang(b.dataset.lang);
    });
    $$('dialog').forEach(function (d) {
      $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    });
    $('#emailDialog').addEventListener('close', function () {
      var wasNew = state.fromSubmit;
      state.fromSubmit = false;
      if (wasNew) { resetForm(); toast('Siap untuk kunjungan berikutnya.'); }
      if (!$('#view-history').hidden) renderHistory();
    });
    $('#detailEmails').addEventListener('click', function () {
      var v = findVisit($('#detailDialog').dataset.id);
      $('#detailDialog').close();
      if (v) openEmailDialog(v, false);
    });

    ['#hSearch', '#hReco', '#hFrom', '#hTo'].forEach(function (id) {
      $(id).addEventListener('input', renderHistory);
      $(id).addEventListener('change', renderHistory);
    });
    $('#historyBody').addEventListener('click', onHistoryClick);
    $('#btnExport').addEventListener('click', exportCsv);

    $('#settingsForm').addEventListener('submit', onSettingsSubmit);
    $('#settingsForm').elements.suratPrefix.addEventListener('input', updateSuratExample);
    $('#btnBackup').addEventListener('click', function () {
      download('klinikHAP-cadangan-' + E.ymd(new Date()) + '.json', JSON.stringify(S.exportAll(), null, 2), 'application/json');
      toast('Cadangan diunduh. Simpan di tempat yang aman (berisi data medis).');
    });
    $('#restoreFile').addEventListener('change', onRestore);
    $('#btnWipe').addEventListener('click', function () {
      var t = window.prompt('Semua riwayat dan pengaturan di laptop ini akan dihapus permanen.\nUnduh cadangan dulu bila perlu.\n\nKetik HAPUS untuk melanjutkan:');
      if (t && t.trim().toUpperCase() === 'HAPUS') {
        S.clearAll(); refreshLists(); resetForm(); loadSettingsForm(); toast('Semua data dihapus.');
      }
    });

    window.addEventListener('beforeunload', function (ev) {
      if (!state.pristine && !state.saved) { ev.preventDefault(); ev.returnValue = ''; }
    });

    refreshLists();
    resetForm();
    tick();
    setInterval(tick, 1000);
    detectServer();
  }

  init();
})();
