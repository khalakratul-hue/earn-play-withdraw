const BN_DIGITS = "০১২৩৪৫৬৭৮৯".split("");

/** Convert ASCII digits inside any value to Bengali numerals. */
export function bn(value: number | string): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Format a taka amount with Bengali numerals, e.g. ৳৫০.০০ */
export function taka(amount: number): string {
  return `৳${bn(amount.toFixed(2))}`;
}
