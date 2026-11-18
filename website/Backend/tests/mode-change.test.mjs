import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

let device = { online: true, mode: 'auto' };
const publishedModes = [];
const recorded = [];

mock.module('../dist/db.js', {
  exports: {
    pool: {
      async execute(sql, args) {
        if (sql.includes('SELECT online, mode')) return [[device]];
        if (sql.includes('INSERT INTO control_commands')) {
          recorded.push(args);
          return [{ affectedRows: 1 }];
        }
        // Mewakili penyiraman aktif atau perintah lama yang masih pending.
        return [[{ id: 1 }]];
      },
    },
  },
});

mock.module('../dist/mqtt/outbound.js', {
  exports: {
    publishMode: async (mode) => { publishedModes.push(mode); },
    publishStart: async () => {},
    publishStop: async () => {},
  },
});

const { setMode } = await import('../dist/services/watering.service.js');

test('pergantian mode diterima meskipun ada penyiraman aktif atau perintah pending', async () => {
  await setMode(1, 'manual');
  await setMode(1, 'auto');
  assert.deepEqual(publishedModes, ['manual', 'auto']);
  assert.equal(recorded.length, 2);
});

test('perangkat offline dan ERROR tetap ditolak', async () => {
  device = { online: false, mode: 'auto' };
  await assert.rejects(setMode(1, 'manual'), /offline/);
  device = { online: true, mode: 'error' };
  await assert.rejects(setMode(1, 'manual'), /ERROR/);
  assert.equal(publishedModes.length, 2);
});
