import type { ColumnMapping, FileData, ProcessingResults, SummaryRow, DetailedRow } from "../types";

interface ExchangeRateMap { [key: string]: number; }

function normalizeDate(value: unknown): string {
  if (!value) return "";
  const str = String(value).trim();
  // Handle Excel serial dates
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + num * 86400000);
    return d.toISOString().slice(0, 10);
  }
  // Handle "2025-01-15 00:00:00" format
  if (str.includes(" ")) {
    const datePart = str.split(" ")[0];
    const parsed = new Date(datePart);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  // Handle various date formats
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  // Handle DD/MM/YYYY
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (Number(a) > 12) {
      const d = new Date(Number(c), Number(b) - 1, Number(a));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return str;
}

export function detectColumnType(values: unknown[]): { type: "text" | "numeric" | "date"; sample: string } {
  let numCount = 0, dateCount = 0, textCount = 0;
  const samples: string[] = [];
  for (const val of values.slice(0, 50)) {
    if (val === null || val === undefined || String(val).trim() === "") continue;
    const str = String(val).trim();
    samples.push(str);
    const num = Number(str);
    if (!isNaN(num) && str !== "") {
      if (num > 30000 && num < 60000) { dateCount++; }
      else { numCount++; }
      continue;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime()) && str.length > 5) { dateCount++; continue; }
    if (str.match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/)) { dateCount++; continue; }
    textCount++;
  }
  const total = numCount + dateCount + textCount;
  if (total === 0) return { type: "text", sample: "" };
  if (dateCount / total > 0.5) return { type: "date", sample: samples[0] || "" };
  if (numCount / total > 0.5) return { type: "numeric", sample: samples[0] || "" };
  return { type: "text", sample: samples[0] || "" };
}

function buildExchangeRateMap(exchangeData: Record<string, unknown>[], mapping: ColumnMapping): { rates: ExchangeRateMap; currencies: Set<string>; dates: Set<string> } {
  const rates: ExchangeRateMap = {};
  const currencies = new Set<string>();
  const dates = new Set<string>();
  const dateCol = mapping["Rate Date"];
  const currCol = mapping["Currency Code"];
  const rateCol = mapping["Exchange Rate"];
  if (!currCol || !rateCol) return { rates, currencies, dates };
  for (const row of exchangeData) {
    const curr = String(row[currCol] || "").trim().toUpperCase();
    const rate = parseFloat(String(row[rateCol] || "0"));
    if (!curr || isNaN(rate) || rate <= 0) continue;
    currencies.add(curr);
    if (dateCol && row[dateCol]) {
      const dateStr = normalizeDate(row[dateCol]);
      if (dateStr) {
        dates.add(dateStr);
        const key = curr + "|" + dateStr;
        rates[key] = rate;
      }
    } else {
      rates[curr] = rate;
    }
  }
  if (!rates["USD"] && !Object.keys(rates).some((k) => k.startsWith("USD|"))) {
    currencies.add("USD");
    if (dates.size > 0) {
      for (const d of dates) { rates["USD|" + d] = 1; }
    } else {
      rates["USD"] = 1;
    }
  }
  return { rates, currencies, dates };
}

function findRate(rates: ExchangeRateMap, currency: string, date: string, hasDates: boolean): { rate: number | null; method: string } {
  if (currency === "USD") return { rate: 1, method: "base" };
  if (hasDates && date) {
    const exactKey = currency + "|" + date;
    if (rates[exactKey] !== undefined) return { rate: rates[exactKey], method: "exact" };
    // Try nearby dates (up to 7 days)
    const d = new Date(date);
    for (let i = 1; i <= 7; i++) {
      const before = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
      const after = new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10);
      if (rates[currency + "|" + before] !== undefined) return { rate: rates[currency + "|" + before], method: "nearby(-" + i + "d)" };
      if (rates[currency + "|" + after] !== undefined) return { rate: rates[currency + "|" + after], method: "nearby(+" + i + "d)" };
    }
    return { rate: null, method: "missing" };
  }
  if (rates[currency] !== undefined) return { rate: rates[currency], method: "average" };
  return { rate: null, method: "missing" };
}

export interface ProcessingError {
  row: number;
  feeCode: string;
  currency: string;
  date: string;
  file: string;
  message: string;
}

export interface EnhancedProcessingResults extends ProcessingResults {
  errors: ProcessingError[];
  currencyTotals: { currency: string; totalLocal: number; totalUSD: number; records: number; avgRate: number }[];
  exchangeRateUsed: boolean;
  grandTotalUSD: number;
}

interface FeeRecord { feeCode: string; feeAmount: number; currency: string; date: string; feeAmountUSD: number; rateUsed: number; rateMethod: string; fileName: string; }

export function processData(
  feeFiles: FileData[],
  feeMappings: Record<string, ColumnMapping>,
  exchangeFile: FileData,
  exchangeMapping: ColumnMapping,
  glFile?: FileData,
  glMapping?: ColumnMapping
): EnhancedProcessingResults {
  const { rates, currencies: exCurrencies, dates: exDates } = buildExchangeRateMap(exchangeFile.data, exchangeMapping);
  const hasDates = exDates.size > 0;
  const allRecords: FeeRecord[] = [];
  const errors: ProcessingError[] = [];
  let rowNum = 0;
  for (const file of feeFiles) {
    const mapping = feeMappings[file.name];
    if (!mapping) continue;
    const feeCodeCol = mapping["Fee Code"];
    const feeAmountCol = mapping["Fee Amount"];
    const currencyCol = mapping["Currency"];
    const dateCol = mapping["Transaction Date"];
    if (!feeCodeCol || !feeAmountCol || !currencyCol) continue;
    for (const row of file.data) {
      rowNum++;
      const feeCode = String(row[feeCodeCol] || "").trim();
      const feeAmountRaw = String(row[feeAmountCol] || "0").replace(/,/g, "");
      const feeAmount = parseFloat(feeAmountRaw);
      const currency = String(row[currencyCol] || "").trim().toUpperCase();
      const dateRaw = dateCol ? row[dateCol] : null;
      const dateStr = dateRaw ? normalizeDate(dateRaw) : "";
      if (!feeCode) { errors.push({ row: rowNum, feeCode: "(empty)", currency, date: dateStr, file: file.name, message: "Missing Fee Code" }); continue; }
      if (isNaN(feeAmount)) { errors.push({ row: rowNum, feeCode, currency, date: dateStr, file: file.name, message: "Invalid Fee Amount: " + String(row[feeAmountCol]) }); continue; }
      if (!currency) { errors.push({ row: rowNum, feeCode, currency: "(empty)", date: dateStr, file: file.name, message: "Missing Currency" }); continue; }
      const { rate, method } = findRate(rates, currency, dateStr, hasDates);
      if (rate === null) {
        errors.push({ row: rowNum, feeCode, currency, date: dateStr, file: file.name, message: "No exchange rate found for " + currency + " on " + (dateStr || "N/A") + ". Please check exchange rate file." });
        continue;
      }
      const feeAmountUSD = feeAmount * rate;
      allRecords.push({ feeCode, feeAmount, currency, date: dateStr, feeAmountUSD, rateUsed: rate, rateMethod: method, fileName: file.name });
    }
  }
  // Summary by Fee Code
  const summaryMap = new Map<string, { records: number; sumUSD: number }>();
  for (const rec of allRecords) {
    const existing = summaryMap.get(rec.feeCode) || { records: 0, sumUSD: 0 };
    existing.records += 1;
    existing.sumUSD += rec.feeAmountUSD;
    summaryMap.set(rec.feeCode, existing);
  }
  // Detailed by Fee Code + Currency
  const detailedMap = new Map<string, DetailedRow>();
  for (const rec of allRecords) {
    const key = rec.feeCode + "|" + rec.currency;
    const existing = detailedMap.get(key) || { feeCode: rec.feeCode, currency: rec.currency, records: 0, sumFeeAmount: 0, sumFeeAmountUSD: 0 };
    existing.records += 1;
    existing.sumFeeAmount += rec.feeAmount;
    existing.sumFeeAmountUSD += rec.feeAmountUSD;
    detailedMap.set(key, existing);
  }
  // Currency totals
  const currTotalMap = new Map<string, { totalLocal: number; totalUSD: number; records: number; rates: number[] }>();
  for (const rec of allRecords) {
    const existing = currTotalMap.get(rec.currency) || { totalLocal: 0, totalUSD: 0, records: 0, rates: [] };
    existing.totalLocal += rec.feeAmount;
    existing.totalUSD += rec.feeAmountUSD;
    existing.records += 1;
    existing.rates.push(rec.rateUsed);
    currTotalMap.set(rec.currency, existing);
  }
  const currencyTotals = Array.from(currTotalMap.entries()).map(([currency, data]) => ({
    currency,
    totalLocal: Math.round(data.totalLocal * 100) / 100,
    totalUSD: Math.round(data.totalUSD * 100) / 100,
    records: data.records,
    avgRate: Math.round((data.rates.reduce((a, b) => a + b, 0) / data.rates.length) * 1000000) / 1000000,
  })).sort((a, b) => b.totalUSD - a.totalUSD);
  // GL comparison
  const glLookup = new Map<string, number>();
  if (glFile && glMapping) {
    const glFeeCodeCol = glMapping["Fee Code"];
    const glAmountCol = glMapping["GL Amount (USD)"];
    if (glFeeCodeCol && glAmountCol) {
      for (const row of glFile.data) {
        const feeCode = String(row[glFeeCodeCol] || "").trim();
        const amountRaw = String(row[glAmountCol] || "0").replace(/,/g, "");
        const amount = parseFloat(amountRaw);
        if (feeCode && !isNaN(amount)) {
          const existing = glLookup.get(feeCode) || 0;
          glLookup.set(feeCode, existing + amount);
        }
      }
    }
  }
  const summary: SummaryRow[] = [];
  for (const [feeCode, data] of summaryMap.entries()) {
    const row: SummaryRow = { feeCode, records: data.records, sumFeeAmountUSD: Math.round(data.sumUSD * 100) / 100 };
    if (glLookup.size > 0) {
      const glAmount = glLookup.get(feeCode);
      if (glAmount !== undefined) {
        row.glAmountUSD = Math.round(glAmount * 100) / 100;
        row.difference = Math.round((row.sumFeeAmountUSD - row.glAmountUSD) * 100) / 100;
        row.differencePercent = row.glAmountUSD !== 0 ? Math.round((row.difference / row.glAmountUSD) * 10000) / 100 : 0;
        row.status = Math.abs(row.difference) < 1 ? "match" : Math.abs(row.difference) < 100 ? "minor" : "mismatch";
      } else {
        row.glAmountUSD = 0;
        row.difference = row.sumFeeAmountUSD;
        row.status = "mismatch";
      }
    }
    summary.push(row);
  }
  summary.sort((a, b) => a.feeCode.localeCompare(b.feeCode));
  const detailed = Array.from(detailedMap.values()).sort((a, b) => a.feeCode.localeCompare(b.feeCode) || a.currency.localeCompare(b.currency));
  const uniqueCurrencies = new Set(allRecords.map((r) => r.currency));
  const grandTotalUSD = Math.round(allRecords.reduce((s, r) => s + r.feeAmountUSD, 0) * 100) / 100;
  return {
    summary,
    detailed,
    totalRecords: allRecords.length,
    totalAmountUSD: grandTotalUSD,
    feeCodesCount: summaryMap.size,
    currenciesCount: uniqueCurrencies.size,
    errors,
    currencyTotals,
    exchangeRateUsed: hasDates,
    grandTotalUSD,
  };
}
