import { percentOf, sum, type Pence } from '../shared/money.ts';
import type { Customer, Invoice, LineItem } from '../db.ts';
import { rateFor, type VatRate } from './vat.ts';

export interface VatBand {
  rate: VatRate;
  net: Pence;
  vat: Pence;
}

export interface InvoiceTotal {
  net: Pence;
  vat: Pence;
  total: Pence;
  // One entry per rate actually used on the invoice, so the invoice can show the
  // zero rated and standard rated portions separately. Accounts need this split.
  bands: VatBand[];
}

export function lineTotal(line: LineItem): Pence {
  return line.quantity * line.unitPence;
}

// Paper invoices carried a printing and postage charge that the web product
// never had. Kept so historic invoices still reconcile.
function legacySurcharge(invoice: Invoice): Pence {
  if (invoice.source === 'LEGACY_PAPER') {
    return 150;
  }
  return 0;
}

// Printing and postage is ancillary to the supply of water rather than a supply
// in its own right, so it takes the same liability as a SUPPLY line would.
function surchargeRate(customer: Customer): VatRate {
  return rateFor('SUPPLY', customer);
}

export function totalFor(invoice: Invoice, customer: Customer): InvoiceTotal {
  const netByRate = new Map<VatRate, Pence>();

  const add = (rate: VatRate, amount: Pence) => {
    netByRate.set(rate, (netByRate.get(rate) ?? 0) + amount);
  };

  for (const line of invoice.lines) {
    add(rateFor(line.kind, customer), lineTotal(line));
  }

  const surcharge = legacySurcharge(invoice);
  if (surcharge !== 0) {
    add(surchargeRate(customer), surcharge);
  }

  // VAT is rounded once per rate band on the band total, not per line. Rounding
  // each line separately drifts by a penny or two against what Finance expect.
  const bands: VatBand[] = [...netByRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, net]) => ({ rate, net, vat: percentOf(net, rate) }));

  const net = sum(bands.map((b) => b.net));
  const vat = sum(bands.map((b) => b.vat));

  return { net, vat, total: net + vat, bands };
}

// The balance owed is VAT inclusive: it is what the customer actually has to pay.
export function outstandingFor(customer: Customer, all: Invoice[]): Pence {
  return sum(
    all
      .filter((i) => i.customerId === customer.id && !i.paid)
      .map((i) => totalFor(i, customer).total),
  );
}
