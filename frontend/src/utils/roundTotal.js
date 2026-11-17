export function roundTotal(amount, noRoundOff) {
  const grandTotal = noRoundOff ? Number(amount.toFixed(2)) : Math.round(amount);
  return { grandTotal, roundOff: noRoundOff ? 0 : Number((grandTotal - amount).toFixed(2)) };
}
