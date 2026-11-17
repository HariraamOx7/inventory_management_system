import assert from 'node:assert/strict';
import { roundTotal } from '../src/utils/roundTotal.js';

// Disabling rounding must preserve paise, and every payable total must reconcile.
for (const amount of [100.49, 100.51, 37.5, 0, 99.999999]) {
  const exact = roundTotal(amount, true);
  assert.equal(exact.grandTotal, Number(amount.toFixed(2)));
  assert.equal(exact.roundOff, 0);
  const rounded = roundTotal(amount, false);
  assert.equal(rounded.grandTotal, Math.round(amount));
  assert.equal(Number((amount + rounded.roundOff).toFixed(2)), rounded.grandTotal);
}
console.log('PASS no-round-off preserves paise and totals reconcile');
