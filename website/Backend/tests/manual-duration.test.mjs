import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validManualDuration } from '../dist/contract.js';

test('preset 30 detik, 1, 2, 3 menit dan custom 5 menit diterima', () => {
  for (const minutes of [0.5, 1, 2, 3, 5]) assert.equal(validManualDuration(minutes), true);
});
test('custom dengan ketelitian satu detik diterima', () => {
  for (let seconds = 30; seconds <= 300; seconds++) assert.equal(validManualDuration(seconds / 60), true);
});
test('durasi di luar batas dan pecahan detik ditolak', () => {
  for (const minutes of [0, 29 / 60, 301 / 60, 30.5 / 60, NaN, Infinity, -1]) {
    assert.equal(validManualDuration(minutes), false);
  }
});
