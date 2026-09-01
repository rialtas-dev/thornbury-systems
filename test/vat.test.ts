import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, outstandingFor } from '../src/invoices/calc.ts';
import { rateFor, STANDARD_RATE, ZERO_RATE } from '../src/invoices/vat.ts';
import { customers, invoices, type Customer, type Invoice } from '../src/db.ts';

const customer = (id: string): Customer => customers.find((c) => c.id === id)!;
const invoice = (id: string): Invoice => invoices.find((i) => i.id === id)!;

test('water supplied to a domestic customer is zero rated', () => {
  assert.equal(rateFor('SUPPLY', customer('C-1001')), ZERO_RATE);
});

test('water supplied to a commercial customer is standard rated', () => {
  assert.equal(rateFor('SUPPLY', customer('C-1002')), STANDARD_RATE);
});

test('engineer work is standard rated for domestic customers too', () => {
  assert.equal(rateFor('SERVICE', customer('C-1001')), STANDARD_RATE);
  assert.equal(rateFor('SERVICE', customer('C-1002')), STANDARD_RATE);
});

test('a customer being VAT registered does not change what we charge them', () => {
  const notRegistered = customer('C-1001');
  const registered = customer('C-1002');
  assert.equal(notRegistered.vatRegistered, false);
  assert.equal(registered.vatRegistered, true);
  // C-1003 is domestic and not registered; C-1004 is commercial and registered.
  // The rate follows accountType, not vatRegistered.
  assert.equal(rateFor('SUPPLY', customer('C-1003')), ZERO_RATE);
  assert.equal(rateFor('SUPPLY', customer('C-1004')), STANDARD_RATE);
});

test('a wholly domestic water invoice carries no VAT', () => {
  const result = totalFor(invoice('INV-9001'), customer('C-1001'));
  assert.equal(result.net, 11338);
  assert.equal(result.vat, 0);
  assert.equal(result.total, 11338);
});

test('a domestic invoice with a call out is VAT free on the water and taxed on the work', () => {
  const result = totalFor(invoice('INV-9003'), customer('C-1003'));
  assert.equal(result.net, 23594);
  assert.equal(result.vat, 2800); // 20% of the 14000 call out only
  assert.equal(result.total, 26394);
  assert.deepEqual(result.bands, [
    { rate: ZERO_RATE, net: 9594, vat: 0 },
    { rate: STANDARD_RATE, net: 14000, vat: 2800 },
  ]);
});

test('a commercial invoice is standard rated throughout', () => {
  const result = totalFor(invoice('INV-9004'), customer('C-1004'));
  assert.equal(result.net, 563400);
  assert.equal(result.vat, 112680);
  assert.equal(result.total, 676080);
  assert.deepEqual(result.bands, [{ rate: STANDARD_RATE, net: 563400, vat: 112680 }]);
});

test('VAT rounds once per band, not per line', () => {
  // Three lines of 111p. Per line, 20% of 111 rounds to 22 each, so 66. On the
  // band total of 333 it is 67. The band total is the one Finance reconcile to.
  const awkward: Invoice = {
    id: 'INV-ODD', customerId: 'C-1002', issued: '2026-08-01', source: 'WEB', paid: false,
    lines: [
      { description: 'a', quantity: 1, unitPence: 111, kind: 'SUPPLY' },
      { description: 'b', quantity: 1, unitPence: 111, kind: 'SUPPLY' },
      { description: 'c', quantity: 1, unitPence: 111, kind: 'SUPPLY' },
    ],
  };
  const result = totalFor(awkward, customer('C-1002'));
  assert.equal(result.net, 333);
  assert.equal(result.vat, 67);
  assert.equal(result.total, 400);
});

test('the outstanding balance is VAT inclusive', () => {
  assert.equal(outstandingFor(customer('C-1003'), invoices), 26394);
  assert.equal(outstandingFor(customer('C-1002'), invoices), 294000);
});
