// VAT liability rules.
//
// VAT Act 1994 Sch 8 Group 2: the supply of water is zero-rated, but NOT when it
// is supplied to an industrial or commercial customer, where it is standard rated.
// Engineer work (SERVICE) is not a supply of water, so it is standard rated for
// everybody, domestic customers included.
//
// That is the "not all of it is vatable" Sandra referred to in JOB-A.
//
// Deliberately NOT keyed off customer.vatRegistered. Whether the customer is
// itself registered for VAT has no bearing on the output VAT we charge them; it
// only affects whether they can reclaim it. Keying off it would zero-rate every
// domestic SERVICE line, which is wrong.

import type { Customer, LineItem } from '../db.ts';

export const STANDARD_RATE = 20;
export const ZERO_RATE = 0;

export type VatRate = typeof STANDARD_RATE | typeof ZERO_RATE;

export function rateFor(kind: LineItem['kind'], customer: Customer): VatRate {
  if (kind === 'SERVICE') {
    return STANDARD_RATE;
  }
  return customer.accountType === 'COMMERCIAL' ? STANDARD_RATE : ZERO_RATE;
}
