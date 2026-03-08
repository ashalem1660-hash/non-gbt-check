function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase().replace(/[_\-\.]/g, " ").trim();
  const bLower = b.toLowerCase().replace(/[_\-\.]/g, " ").trim();
  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;
  const matrix: number[][] = [];
  for (let i = 0; i <= aLower.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= bLower.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= aLower.length; i++) {
    for (let j = 1; j <= bLower.length; j++) {
      const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1;
  return 1 - matrix[aLower.length][bLower.length] / maxLen;
}

const ALIASES: Record<string, string[]> = {
  "Fee Code": ["feecode", "fee_code", "fee code", "feeid", "fee_id", "code", "fee type", "feetype"],
  "Fee Amount": ["feeamount", "fee_amount", "fee amount", "amount", "fee_amt", "feeamt", "sum", "total"],
  "Currency": ["currency", "curr", "ccy", "currency_code", "currencycode", "cur"],
  "Transaction Date": ["transactiondate", "transaction_date", "transaction date", "txn_date", "txndate", "date", "trans_date"],
  "Currency Code": ["currency code", "currency_code", "currencycode", "curr_code", "ccy", "curr"],
  "Exchange Rate": ["exchange rate", "exchange_rate", "exchangerate", "exch_rate", "rate", "fx_rate", "avg rate"],
  "GL Amount (USD)": ["gl_amount", "glamount", "gl amount", "gl_amount_usd", "gl amount usd", "ledger_amount", "book_amount"],
};

export function autoDetectMapping(
  systemFields: string[],
  fileColumns: string[]
): { mapping: Record<string, string | null>; confidence: Record<string, number> } {
  const mapping: Record<string, string | null> = {};
  const confidence: Record<string, number> = {};
  const usedColumns = new Set<string>();
  for (const sysField of systemFields) {
    let bestMatch: string | null = null;
    let bestScore = 0;
    for (const col of fileColumns) {
      if (usedColumns.has(col)) continue;
      const aliases = ALIASES[sysField] || [];
      const colNorm = col.toLowerCase().replace(/[_\-\.]/g, " ").trim();
      if (aliases.includes(colNorm)) {
        if (0.95 > bestScore) { bestScore = 0.95; bestMatch = col; }
        continue;
      }
      const score = similarity(sysField, col);
      if (score > bestScore && score >= 0.4) { bestScore = score; bestMatch = col; }
    }
    if (bestMatch && bestScore >= 0.4) {
      mapping[sysField] = bestMatch;
      confidence[sysField] = bestScore;
      usedColumns.add(bestMatch);
    } else {
      mapping[sysField] = null;
      confidence[sysField] = 0;
    }
  }
  return { mapping, confidence };
}
