import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

const commands = [];
const published = [];
let activeZone;

function busyRows(sql) {
  if (sql.includes('FROM watering_events')) return activeZone ? [{ id: activeZone }] : [];
  return commands.filter(({ outcome }) =>
    outcome === 'sent' || outcome === 'running' || (sql.includes("'queued'") && outcome === 'queued'),
  );
}

const connection = {
  async beginTransaction() {},
  async commit() {},
  async rollback() {},
  release() {},
  async execute(sql, args) {
    if (sql.includes('SELECT')) return [busyRows(sql)];
    assert.match(sql, /INSERT INTO control_commands/);
    commands.push({
      id: commands.length + 1,
      zone_id: args[1],
      duration_min: args[2],
      duration_sec: JSON.parse(args[4]).durationSec,
      outcome: 'queued',
    });
    return [{ affectedRows: 1 }];
  },
};

mock.module('../dist/db.js', {
  exports: {
    pool: {
      getConnection: async () => connection,
      async execute(sql, args) {
        if (sql.includes('SELECT online, mode')) return [[{ online: true, mode: 'auto' }]];
        if (sql.includes("WHERE type = 'start' AND outcome = 'queued'")) {
          return [commands.filter((command) => command.outcome === 'queued').slice(0, 1)];
        }
        if (sql.includes("UPDATE control_commands SET outcome = 'sent'")) {
          commands.find((command) => command.id === args[0]).outcome = 'sent';
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('SELECT')) return [busyRows(sql)];
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
  },
});

mock.module('../dist/mqtt/outbound.js', {
  exports: {
    publishStart: async (zone, duration) => { published.push({ zone, duration }); },
    publishMode: async () => {},
    publishStop: async () => {},
  },
});

const { dispatchNextQueued, startWatering, withWateringLock } = await import('../dist/services/watering.service.js');

beforeEach(() => {
  commands.length = 0;
  published.length = 0;
  activeZone = undefined;
});

test('saat AUTO, memilih V08 hanya menyimpan dan mengirim perintah untuk V08', async () => {
  await startWatering(1, 0.5, 8);
  assert.deepEqual(commands.map((command) => command.zone_id), [8]);
  assert.equal(commands[0].duration_min, null);
  assert.equal(commands[0].duration_sec, 30);
  assert.deepEqual(published, [{ zone: 8, duration: 0.5 }]);
});

test('saat AUTO, permintaan tanpa zone mengantrekan semua jalur dan mengirim V01 dahulu', async () => {
  await startWatering(1, 1);
  assert.deepEqual(commands.map((command) => command.zone_id), Array.from({ length: 13 }, (_, i) => i + 1));
  assert.equal(commands.filter((command) => command.outcome === 'queued').length, 12);
  assert.deepEqual(published, [{ zone: 1, duration: 1 }]);
});

test('jalur di luar V01–V13 atau angka pecahan ditolak sebelum disimpan', async () => {
  for (const zone of [0, 14, 1.5]) {
    await assert.rejects(startWatering(1, 1, zone), /Jalur penyiraman tidak valid/);
  }
  assert.equal(commands.length, 0);
  assert.equal(published.length, 0);
});

test('jalur tambahan menunggu konfirmasi tutup dan berjalan sesuai urutan permintaan', async () => {
  await startWatering(1, 1, 1);
  // V01 sudah dikirim, tetapi controller belum melaporkan valve terbuka.
  await startWatering(1, 0.5, 12);
  assert.deepEqual(published, [{ zone: 1, duration: 1 }]);

  activeZone = 1;
  commands[0].outcome = 'running';
  await startWatering(1, 2, 3);
  assert.deepEqual(commands.map(({ zone_id, outcome }) => [zone_id, outcome]), [
    [1, 'running'], [12, 'queued'], [3, 'queued'],
  ]);
  await assert.rejects(startWatering(1, 1), /sebelum memulai Semua Jalur/);

  // Laporan valve tutup menyelesaikan perintah aktif sebelum dispatch berikutnya.
  activeZone = undefined;
  commands[0].outcome = 'done';
  await withWateringLock(dispatchNextQueued);
  assert.deepEqual(published, [{ zone: 1, duration: 1 }, { zone: 12, duration: 0.5 }]);
  assert.equal(commands[2].outcome, 'queued');
});
