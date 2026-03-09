function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase().replace(/[_\-\.]/g, " ").trim();
  const bLower = b.toLowerCase().replace(/[_\-\.]/g, " ").trim();
  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.85;
  // Token overlap
  const aTokens = new Set(aLower.split(/\s+/));
  const bTokens = new Set(bLower.split(/\s+/));
  let overlap = 0;
  for (const t of aTokens) { if (bTokens.has(t)) overlap++; }
  const tokenScore = overlap / Math.max(aTokens.size, bTokens.size);
  if (tokenScore >= 0.5) return 0.6 + tokenScore * 0.3;
  // Levenshtein
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
  "Fee Code": [
    "feecode", "fee_code", "fee code", "feeid", "fee_id", "code", "fee type", "feetype",
    "fee_type", "transaction_code", "trans_code", "txn_code", "product_code", "fee code",
  ],
  "Fee Amount": [
    "feeamount", "fee_amount", "fee amount", "amount", "fee_amt", "feeamt", "sum", "total",
    "transaction_amount", "trans_amount", "txn_amount", "net_amount", "gross_amount",
    "fee amount", "amounttaken", "amount taken", "debtamount", "debt amount",
  ],
  "Currency": [
    "currency", "curr", "ccy", "currency_code", "currencycode", "cur", "transaction_currency",
    "txn_currency", "original_currency", "orig_currency", "payment_currency", "fee_currency",
  ],
  "Transaction Date": [
    "transactiondate", "transaction_date", "transaction date", "txn_date", "txndate",
    "date", "trans_date", "posting_date", "value_date", "trade_date", "settlement_date",
    "effective_date", "process_date", "created_date", "entry_date",
  ],
  "Rate Date": [
    "rate date", "rate_date", "ratedate", "starting date", "starting_date", "startingdate",
    "date", "effective_date", "exchange_date", "fx_date", "value_date", "valid_date",
    "from_date", "as_of_date",
  ],
  "Currency Code": [
    "currency code", "currency_code", "currencycode", "curr_code", "ccy", "curr",
    "currency", "iso_currency", "from_currency", "source_currency",
    "relational currency code", "relational_currency_code",
  ],
  "Exchange Rate": [
    "exchange rate", "exchange_rate", "exchangerate", "exch_rate", "rate", "fx_rate",
    "avg rate", "average_rate", "conversion_rate", "spot_rate", "mid_rate",
    "relational exch. rate amount", "relational exch rate amount",
    "relational_exch_rate_amount", "exchange rate amount", "exchange_rate_amount",
    "fix exchange rate amount", "adjustment exch. rate amount",
    "relational adjmt exch rate amt", "fxrate", "fx rate",
  ],
  "GL Amount (USD)": [
    "gl_amount", "glamount", "gl amount", "gl_amount_usd", "gl amount usd",
    "ledger_amount", "book_amount", "gl amount (usd)", "usd_amount", "amount_usd",
    "usdequivalentfxconversionfeeamount", "usd equivalent", "usd_equivalent",
  ],
};

export function autoDetectMapping(
  systemFields: string[],
  fileColumns: string[]
): { mapping: Record<string, string | null>; confidence: Record<string, number> } {
  const mapping: Record<string, string | null> = {};
  const confidence: Record<string, number> = {};
  const usedColumns = new Set<string>();
  // First pass: exact alias matches (highest priority)
  for (const sysField of systemFields) {
    const aliases = ALIASES[sysField] || [];
    let bestMatch: string | null = null;
    let bestScore = 0;
    for (const col of fileColumns) {
      if (usedColumns.has(col)) continue;
      const colNorm = col.toLowerCase().replace(/[_\-\.]/g, " ").trim();
      // Exact alias match
      if (aliases.includes(colNorm)) {
        if (0.98 > bestScore) { bestScore = 0.98; bestMatch = col; }
        continue;
      }
      // Partial alias match (alias contained in column name or vice versa)
      for (const alias of aliases) {
        if (colNorm.includes(alias) || alias.includes(colNorm)) {
          const score = 0.85;
          if (score > bestScore) { bestScore = score; bestMatch = col; }
        }
      }
    }
    if (bestMatch && bestScore >= 0.8) {
      mapping[sysField] = bestMatch;
      confidence[sysField] = bestScore;
      usedColumns.add(bestMatch);
    }
  }
  // Second pass: fuzzy matching for unmapped fields
  for (const sysField of systemFields) {
    if (mapping[sysField]) continue;
    let bestMatch: string | null = null;
    let bestScore = 0;
    for (const col of fileColumns) {
      if (usedColumns.has(col)) continue;
      const score = similarity(sysField, col);
      if (score > bestScore && score >= 0.4) { bestScore = score; bestMatch = col; }
      // Also check aliases for fuzzy
      const aliases = ALIASES[sysField] || [];
      for (const alias of aliases) {
        const aliasScore = similarity(alias, col);
        if (aliasScore > bestScore && aliasScore >= 0.5) { bestScore = aliasScore; bestMatch = col; }
      }
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

export function getFieldHelp(fieldName: string): string {
  const help: Record<string, string> = {
    "Fee Code": "The unique identifier for each fee type. This is used to group and summarize transactions. Common formats: numeric codes (3004, 3032) or alphanumeric (FEE-001).",
    "Fee Amount": "The transaction amount in its original (local) currency. This will be converted to USD using the exchange rate. Can be positive or negative.",
    "Currency": "The 3-letter ISO currency code of the transaction (e.g., USD, EUR, GBP, JPY). Must match the currency codes in your exchange rate file.",
    "Transaction Date": "The date when the transaction occurred. Used to find the matching daily exchange rate. Supported formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, Excel serial dates.",
    "Rate Date": "The date for which the exchange rate is valid. Each row should have one date, one currency, and one rate. Format should match transaction dates.",
    "Currency Code": "The 3-letter ISO currency code in the exchange rate file. Must match the currency codes used in fee transaction files.",
    "Exchange Rate": "The exchange rate to convert from the local currency to USD. For example, if 1 EUR = 1.08 USD, the rate should be 1.08. Also known as: Relational Exch. Rate Amount.",
    "GL Amount (USD)": "The General Ledger amount in USD for comparison. Used to verify that the calculated fee amounts match the booked amounts in the ledger.",
  };
  return help[fieldName] || "Map this field to the corresponding column in your file.";
}
