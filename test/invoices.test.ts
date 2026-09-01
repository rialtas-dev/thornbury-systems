import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, lineTotal, outstandingFor } from '../src/invoices/calc.ts';
import { customers, invoices, type Customer, type Invoice } from '../src/db.ts';

const customer = (id: string): Customer => customers.find((c) => c.id === id)!;
const invoice = (id: string): Invoice => invoices.find((i) => i.id === id)!;

test('line totals multiply quantity by unit price', () => {
  assert.equal(lineTotal({ description: 'x', quantity: 41, unitPence: 218, kind: 'SUPPLY' }), 8938);
});

test('invoice totals are calculated for every invoice', () => {
  for (const i of invoices) {
    totalFor(i, customer(i.customerId));
  }
});

test('outstanding balance ignores paid invoices', () => {
  assert.equal(outstandingFor(customer('C-1001'), invoices), 0);
});

test('commercial invoice totals', () => {
  const result = totalFor(invoice('INV-9002'), customer('C-1002'));
  assert.equal(result.net, 245000);
  assert.equal(result.vat, 49000);
  assert.equal(result.total, 294000);
});

test('legacy paper invoices carry the postage surcharge', () => {
  const paper: Invoice = {
    id: 'INV-0001',
    customerId: 'C-1001',
    issued: '2018-03-01',
    source: 'LEGACY_PAPER',
    paid: true,
    lines: [{ description: 'Metered supply', quantity: 10, unitPence: 100, kind: 'SUPPLY' }],
  };
  const result = totalFor(paper, customer('C-1001'));
  assert.equal(result.net, 1150);
  // Ancillary to a zero rated supply of water, so the surcharge is zero rated too
  // and the historic total still reconciles.
  assert.equal(result.total, 1150);
});
