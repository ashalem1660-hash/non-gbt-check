import type { ColumnMapping, FileData, ProcessingResults, SummaryRow, DetailedRow } from "../types";

interface ExchangeRateMap { [currency: string]: number; }

function buildExchangeRateMap(exchangeData: Record<string, unknown>[], mapping: ColumnMapping): ExchangeRateMap {
  const rates: ExchangeRateMap = {};
  const currCol = mapping["Currency Code"];
  const rateCol = mapping["Exchange Rate"];
  if (!currCol || !rateCol) return rates;
  const groups: Record<string, number[]> = {};
  for (const row of exchangeData) {
    const curr = String(row[currCol] || "").trim().toUpperCase();
    const rate = parseFloat(String(row[rateCol] || "0"));
    if (curr && !isNaN(rate) && rate > 0) {
      if (!groups[curr]) groups[curr] = [];
      groups[curr].push(rate);
    }
  }
  for (const [curr, values] of Object.entries(groups)) {
    rates[curr] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  return rates;
}

interface FeeRecord { feeCode: string; feeAmount: number; currency: string; feeAmountUSD: number; }

export function processData(
  feeFiles: FileData[],
  feeMappings: Record<string, ColumnMapping>,
  exchangeFile: FileData,
  exchangeMapping: ColumnMapping,
  glFile?: FileData,
  glMapping?: ColumnMapping
): ProcessingResults {
  const exchangeRates = buildExchangeRateMap(exchangeFile.data, exchangeMapping);
  const allRecords: FeeRecord[] = [];
  for (const file of feeFiles) {
    const mapping = feeMappings[file.name];
    if (!mapping) continue;
    const feeCodeCol = mapping["Fee Code"];
    const feeAmountCol = mapping["Fee Amount"];
    const currencyCol = mapping["Currency"];
    if (!feeCodeCol || !feeAmountCol || !currencyCol) continue;
    for (const row of file.data) {
      const feeCode = String(row[feeCodeCol] || "").trim();
      const feeAmount = parseFloat(String(row[feeAmountCol] || "0"));
      const currency = String(row[currencyCol] || "").trim().toUpperCase();
      if (!feeCode || isNaN(feeAmount)) continue;
      const rate = exchangeRates[currency] || (currency === "USD" ? 1 : 0);
      const feeAmountUSD = feeAmount * rate;
      allRecords.push({ feeCode, feeAmount, currency, feeAmountUSD });
    }
  }
  const summaryMap = new Map<string, { records: number; sumUSD: number }>();
  for (const rec of allRecords) {
    const existing = summaryMap.get(rec.feeCode) || { records: 0, sumUSD: 0 };
    existing.records += 1;
    existing.sumUSD += rec.feeAmountUSD;
    summaryMap.set(rec.feeCode, existing);
  }
  const detailedMap = new Map<string, DetailedRow>();
  for (const rec of allRecords) {
    const key = rec.feeCode + "|" + rec.currency;
    const existing = detailedMap.get(key) || { feeCode: rec.feeCode, currency: rec.currency, records: 0, sumFeeAmount: 0, sumFeeAmountUSD: 0 };
    existing.records += 1;
    existing.sumFeeAmount += rec.feeAmount;
    existing.sumFeeAmountUSD += rec.feeAmountUSD;
    detailedMap.set(key, existing);
  }
  const glLookup = new Map<string, number>();
  if (glFile && glMapping) {
    const glFeeCodeCol = glMapping["Fee Code"];
    const glAmountCol = glMapping["GL Amount (USD)"];
    if (glFeeCodeCol && glAmountCol) {
      for (const row of glFile.data) {
        const feeCode = String(row[glFeeCodeCol] || "").trim();
        const amount = parseFloat(String(row[glAmountCol] || "0"));
        if (feeCode && !isNaN(amount)) { glLookup.set(feeCode, amount); }
      }
    }
  }
  const summary: SummaryRow[] = [];
  for (const [feeCode, data] of summaryMap.entries()) {
    const row: SummaryRow = { feeCode, records: data.records, sumFeeAmountUSD: Math.round(data.sumUSD * 100) / 100 };
    if (glLookup.size > 0) {
      const glAmount = glLookup.get(feeCode);
      if (glAmount !== undefined) {
        row.glAmountUSD = glAmount;
        row.difference = Math.round((row.sumFeeAmountUSD - glAmount) * 100) / 100;
        row.differencePercent = glAmount !== 0 ? Math.round((row.difference / glAmount) * 10000) / 100 : 0;
        row.status = Math.abs(row.difference) < 1 ? "match" : Math.abs(row.difference) < 100 ? "minor" : "mismatch";
      }
    }
    summary.push(row);
  }
  summary.sort((a, b) => a.feeCode.localeCompare(b.feeCode));
  const detailed = Array.from(detailedMap.values()).sort((a, b) => a.feeCode.localeCompare(b.feeCode) || a.currency.localeCompare(b.currency));
  const uniqueCurrencies = new Set(allRecords.map((r) => r.currency));
  return {
    summary,
    detailed,
    totalRecords: allRecords.length,
    totalAmountUSD: Math.round(allRecords.reduce((s, r) => s + r.feeAmountUSD, 0) * 100) / 100,
    feeCodesCount: summaryMap.size,
    currenciesCount: uniqueCurrencies.size,
  };
}
