'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/store.js');

function fresh() { return S.create(S.memoryStorage()); }
function v(id, over) {
  return Object.assign({ id, nik: '1', name: 'A', dept: 'X', visitAt: new Date(2026, 10, 18, 8, 0).toISOString(), emailStatus: { worker: false, boss: false } }, over || {});
}

test('nomor urut per prefix+tanggal, tidak dipakai ulang setelah hapus', () => {
  const s = fresh();
  assert.equal(s.nextSeq('SK/KLL', '20261118'), 1);
  assert.equal(s.nextSeq('SK/KLL', '20261118'), 2);
  assert.equal(s.nextSeq('SK/KLL', '20261119'), 1);
  assert.equal(s.nextSeq('SK/XYZ', '20261118'), 1);
  s.addVisit(v('a')); s.deleteVisit('a');
  assert.equal(s.nextSeq('SK/KLL', '20261118'), 3);
});

test('kunjungan: tambah, ubah, urut terbaru dahulu, hapus', () => {
  const s = fresh();
  s.addVisit(v('old', { visitAt: new Date(2026, 10, 1).toISOString() }));
  s.addVisit(v('new', { visitAt: new Date(2026, 10, 18).toISOString() }));
  assert.deepEqual(s.listVisits().map((x) => x.id), ['new', 'old']);
  s.updateVisit('new', { emailStatus: { worker: true, boss: false } });
  assert.equal(s.listVisits()[0].emailStatus.worker, true);
  assert.equal(s.deleteVisit('old'), 1);
  assert.equal(s.listVisits().length, 1);
});

test('direktori NIK mengingat data pekerja', () => {
  const s = fresh();
  s.rememberWorker(v('a', { nik: '007', name: 'Bond', dept: 'QSHE', workerEmail: 'b@x.id' }));
  assert.equal(s.lookupWorker('007').name, 'Bond');
  assert.equal(s.lookupWorker('008'), null);
  assert.equal(s.lookupWorker('__proto__'), null);
  assert.equal(s.lookupWorker('constructor'), null);
});

test('pengaturan: bawaan + penimpaan sebagian', () => {
  const s = fresh();
  assert.equal(s.getSettings().suratPrefix, 'SK/KLL');
  s.saveSettings({ nurseName: 'Rina' });
  assert.equal(s.getSettings().nurseName, 'Rina');
  assert.equal(s.getSettings().clinicName, 'Klinik HAP');
});

test('cadangan: ekspor lalu impor menggabungkan tanpa duplikat dan menolak berkas asing', () => {
  const a = fresh();
  a.addVisit(v('1')); a.addVisit(v('2')); a.nextSeq('SK/KLL', '20261118'); a.nextSeq('SK/KLL', '20261118');
  const dump = JSON.parse(JSON.stringify(a.exportAll()));
  const b = fresh();
  b.addVisit(v('2')); b.nextSeq('SK/KLL', '20261118');
  const res = b.importAll(dump);
  assert.deepEqual(res, { added: 1, skipped: 1 });
  assert.equal(b.listVisits().length, 2);
  assert.equal(b.nextSeq('SK/KLL', '20261118'), 3); // counter diambil yang terbesar
  assert.throws(() => b.importAll({ foo: 1 }), /bukan cadangan/i);
  assert.throws(() => b.importAll(null));
  assert.deepEqual(b.importAll({ app: 'klinikHAP', visits: [{ id: 5 }, null, { id: 'x' }] }), { added: 0, skipped: 3 });
});

test('hapus semua data', () => {
  const s = fresh();
  s.addVisit(v('1')); s.saveSettings({ nurseName: 'X' }); s.clearAll();
  assert.equal(s.listVisits().length, 0);
  assert.equal(s.getSettings().nurseName, '');
});
