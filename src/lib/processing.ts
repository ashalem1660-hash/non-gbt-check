import type { FileData, ColumnMapping, ProcessingResults, SummaryRow, DetailedRow } from "../types";

export interface EnhancedProcessingResults extends ProcessingResults {
  currencyTotals: { currency: string; records: number; totalLocal: number; totalUSD: number; avgRate: number }[];
  errors: { row: number; file: string; feeCode: string; currency: string; date?: string; message: string }[];
  grandTotalUSD: number;
  exchangeRateUsed: boolean;
}

export function detectColumnType(values: unknown[]): { type: "text" | "numeric" | "date"; sample: string } {
  const samples = values.slice(0, 100).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (samples.length === 0) return { type: "text", sample: "" };
  let numCount = 0, dateCount = 0;
  for (const v of samples) {
    const s = String(v).trim().replace(/,/g, "");
    if (!isNaN(parseFloat(s)) && isFinite(Number(s))) { numCount++; continue; }
    if (isDateLike(s) || v instanceof Date) { dateCount++; continue; }
  }
  if (numCount > samples.length * 0.7) return { type: "numeric", sample: String(samples[0]) };
  if (dateCount > samples.length * 0.7) return { type: "date", sample: String(samples[0]) };
  return { type: "text", sample: String(samples[0]) };
}

function isDateLike(s: string): boolean {
  if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(s)) return true;
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(s)) return true;
  if (/^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(s)) return true;
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i.test(s)) return true;
  return false;
}

function detectDateFormat(dates: string[]): "DMY" | "MDY" | "YMD" | "unknown" {
  // Analyze a sample of dates to determine the format
  let dmyScore = 0;
  let mdyScore = 0;
  let ymdScore = 0;
  const sample = dates.slice(0, 200).filter((d) => d && typeof d === "string");

  for (const d of sample) {
    const clean = d.trim();
    // YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(clean)) {
      ymdScore += 10;
      continue;
    }
    // DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
    const match = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (match) {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);
      // If first > 12, it must be day (DD/MM/YYYY)
      if (first > 12) { dmyScore += 10; continue; }
      // If second > 12, it must be month position (MM/DD/YYYY)
      if (second > 12) { mdyScore += 10; continue; }
      // Both could be day or month - use heuristics
      // For Q4 data (Oct-Dec), months 10,11,12 are expected
      // If first is 10,11,12 and second is 1-31, likely MM/DD
      // If second is 10,11,12 and first is 1-31, likely DD/MM
      if (first <= 12 && second <= 12) {
        // Ambiguous - give slight preference to DMY (European/Israeli format)
        dmyScore += 1;
      }
    }
  }

  if (ymdScore > dmyScore && ymdScore > mdyScore) return "YMD";
  if (dmyScore > mdyScore) return "DMY";
  if (mdyScore > dmyScore) return "MDY";
  return "DMY"; // Default to DMY for Israeli format
}

function parseSmartDate(value: unknown, format: "DMY" | "MDY" | "YMD" | "unknown"): string | null {
  if (value === null || value === undefined) return null;

  // Handle Date objects (from Excel cellDates: true)
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    if (y > 1990 && y < 2100) return y + "-" + m + "-" + d;
    return null;
  }

  const s = String(value).trim();
  if (!s) return null;

  // Excel serial date number
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    if (y > 1990 && y < 2100) return y + "-" + m + "-" + d;
    return null;
  }

  // ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1]);
    const m = String(parseInt(isoMatch[2])).padStart(2, "0");
    const d = String(parseInt(isoMatch[3])).padStart(2, "0");
    if (y > 1990 && y < 2100 && parseInt(m) >= 1 && parseInt(m) <= 12 && parseInt(d) >= 1 && parseInt(d) <= 31) {
      return y + "-" + m + "-" + d;
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (slashMatch) {
    let first = parseInt(slashMatch[1]);
    let second = parseInt(slashMatch[2]);
    let year = parseInt(slashMatch[3]);
    if (year < 100) year += 2000;

    let day: number, month: number;

    if (format === "DMY") {
      day = first;
      month = second;
    } else if (format === "MDY") {
      month = first;
      day = second;
    } else {
      // Auto-detect for this specific date
      if (first > 12) { day = first; month = second; }
      else if (second > 12) { month = first; day = second; }
      else { day = first; month = second; } // Default DMY
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1990 && year < 2100) {
      return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    }
  }

  // Text month formats: "1 Oct 2025", "Oct 1, 2025", "October 1 2025"
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    january: "01", february: "02", march: "03", april: "04", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12"
  };
  const textMatch = s.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i) ||
                    s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (textMatch) {
    if (/^\d/.test(textMatch[1])) {
      const d = String(parseInt(textMatch[1])).padStart(2, "0");
      const m = months[textMatch[2].toLowerCase().slice(0, 3)] || "01";
      const y = textMatch[3];
      return y + "-" + m + "-" + d;
    } else {
      const m = months[textMatch[1].toLowerCase().slice(0, 3)] || "01";
      const d = String(parseInt(textMatch[2])).padStart(2, "0");
      const y = textMatch[3];
      return y + "-" + m + "-" + d;
    }
  }

  // Try native Date.parse as last resort
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y > 1990 && y < 2100) {
      return y + "-" + String(parsed.getMonth() + 1).padStart(2, "0") + "-" + String(parsed.getDate()).padStart(2, "0");
    }
  }

  return null;
}

function buildExchangeRateMap(
  exchangeFile: FileData,
  exchangeMapping: ColumnMapping,
  dateFormat: "DMY" | "MDY" | "YMD" | "unknown"
): { rateMap: Map<string, number>; availableDates: Set<string>; availableCurrencies: Set<string> } {
  const rateMap = new Map<string, number>();
  const availableDates = new Set<string>();
  const availableCurrencies = new Set<string>();
  const dateCol = exchangeMapping["Rate Date"];
  const currCol = exchangeMapping["Currency Code"];
  const rateCol = exchangeMapping["Exchange Rate"];

  for (const row of exchangeFile.data) {
    const currency = currCol ? String(row[currCol] || "").trim().toUpperCase() : "";
    const rateVal = rateCol ? parseFloat(String(row[rateCol] || "0").replace(/,/g, "")) : 0;
    if (!currency || isNaN(rateVal) || rateVal === 0) continue;
    availableCurrencies.add(currency);

    if (dateCol) {
      const dateStr = parseSmartDate(row[dateCol], dateFormat);
      if (dateStr) {
        availableDates.add(dateStr);
        const key = currency + "|" + dateStr;
        rateMap.set(key, rateVal);
      }
    } else {
      // No date column - use as single rate
      rateMap.set(currency + "|ANY", rateVal);
    }
  }

  return { rateMap, availableDates, availableCurrencies };
}

function findRate(
  rateMap: Map<string, number>,
  currency: string,
  dateStr: string | null,
  availableDates: Set<string>
): { rate: number | null; method: string } {
  if (currency === "USD") return { rate: 1, method: "USD=1" };

  // Exact date match
  if (dateStr) {
    const exactKey = currency + "|" + dateStr;
    if (rateMap.has(exactKey)) return { rate: rateMap.get(exactKey)!, method: "exact" };

    // Search nearby dates (up to 30 days)
    const targetDate = new Date(dateStr);
    for (let offset = 1; offset <= 30; offset++) {
      for (const dir of [-1, 1]) {
        const tryDate = new Date(targetDate.getTime() + dir * offset * 86400000);
        const tryStr = tryDate.getFullYear() + "-" + String(tryDate.getMonth() + 1).padStart(2, "0") + "-" + String(tryDate.getDate()).padStart(2, "0");
        const tryKey = currency + "|" + tryStr;
        if (rateMap.has(tryKey)) return { rate: rateMap.get(tryKey)!, method: "nearest (" + offset + "d)" };
      }
    }
  }

  // Try ANY (no date in exchange file)
  const anyKey = currency + "|ANY";
  if (rateMap.has(anyKey)) return { rate: rateMap.get(anyKey)!, method: "single rate" };

  return { rate: null, method: "not found" };
}

export function processData(
  feeFiles: FileData[],
  feeMappings: Record<string, ColumnMapping>,
  exchangeFile: FileData,
  exchangeMapping: ColumnMapping,
  glFile?: FileData,
  glMapping?: ColumnMapping
): EnhancedProcessingResults {
  const errors: { row: number; file: string; feeCode: string; currency: string; date?: string; message: string }[] = [];

  // Detect date format from fee files
  const allFeeDateValues: string[] = [];
  for (const file of feeFiles) {
    const mapping = feeMappings[file.name] || {};
    const dateCol = mapping["Transaction Date"];
    if (dateCol) {
      for (const row of file.data.slice(0, 500)) {
        const val = row[dateCol];
        if (val !== null && val !== undefined && !(val instanceof Date)) {
          allFeeDateValues.push(String(val));
        }
      }
    }
  }
  const feeDateFormat = detectDateFormat(allFeeDateValues);

  // Also detect exchange rate date format
  const exDateCol = exchangeMapping["Rate Date"];
  const exDateValues: string[] = [];
  if (exDateCol) {
    for (const row of exchangeFile.data.slice(0, 500)) {
      const val = row[exDateCol];
      if (val !== null && val !== undefined && !(val instanceof Date)) {
        exDateValues.push(String(val));
      }
    }
  }
  const exDateFormat = detectDateFormat(exDateValues);

  // Build exchange rate map
  const { rateMap, availableDates, availableCurrencies } = buildExchangeRateMap(exchangeFile, exchangeMapping, exDateFormat);

  // Process fee transactions
  const feeCodeMap = new Map<string, { records: number; sumUSD: number }>();
  const detailedMap = new Map<string, { feeCode: string; currency: string; records: number; sumLocal: number; sumUSD: number }>();
  const currencyMap = new Map<string, { records: number; totalLocal: number; totalUSD: number; rateSum: number }>();

  let totalRecords = 0;
  let totalUSD = 0;

  for (const file of feeFiles) {
    const mapping = feeMappings[file.name] || {};
    const feeCodeCol = mapping["Fee Code"];
    const amountCol = mapping["Fee Amount"];
    const currencyCol = mapping["Currency"];
    const dateCol = mapping["Transaction Date"];

    for (let i = 0; i < file.data.length; i++) {
      const row = file.data[i];
      const feeCode = feeCodeCol ? String(row[feeCodeCol] || "").trim() : "UNKNOWN";
      const amountStr = amountCol ? String(row[amountCol] || "0").replace(/,/g, "") : "0";
      const amount = parseFloat(amountStr);
      const currency = currencyCol ? String(row[currencyCol] || "").trim().toUpperCase() : "USD";
      const dateStr = dateCol ? parseSmartDate(row[dateCol], feeDateFormat) : null;

      if (!feeCode || feeCode === "UNKNOWN" || feeCode === "") {
        errors.push({ row: i + 2, file: file.name, feeCode: "", currency, date: dateStr || undefined, message: "Missing fee code" });
        continue;
      }
      if (isNaN(amount)) {
        errors.push({ row: i + 2, file: file.name, feeCode, currency, date: dateStr || undefined, message: "Invalid amount: " + amountStr });
        continue;
      }
      if (!currency) {
        errors.push({ row: i + 2, file: file.name, feeCode, currency: "", date: dateStr || undefined, message: "Missing currency code" });
        continue;
      }

      const { rate, method } = findRate(rateMap, currency, dateStr, availableDates);
      if (rate === null) {
        const dateInfo = dateStr ? " on " + dateStr : " (no date)";
        const hint = availableCurrencies.has(currency) ? ". Rate exists for " + currency + " but not for this date." : ". Currency " + currency + " not found in exchange rate file.";
        errors.push({ row: i + 2, file: file.name, feeCode, currency, date: dateStr || undefined, message: "No exchange rate for " + currency + dateInfo + hint + " Available dates: " + (availableDates.size > 0 ? "from " + Array.from(availableDates).sort()[0] + " to " + Array.from(availableDates).sort().pop() : "none") });
        continue;
      }

      const amountUSD = amount * rate;
      totalRecords++;
      totalUSD += amountUSD;

      // Fee code summary
      const existing = feeCodeMap.get(feeCode) || { records: 0, sumUSD: 0 };
      existing.records++;
      existing.sumUSD += amountUSD;
      feeCodeMap.set(feeCode, existing);

      // Detailed by fee code + currency
      const detailKey = feeCode + "|" + currency;
      const det = detailedMap.get(detailKey) || { feeCode, currency, records: 0, sumLocal: 0, sumUSD: 0 };
      det.records++;
      det.sumLocal += amount;
      det.sumUSD += amountUSD;
      detailedMap.set(detailKey, det);

      // Currency totals
      const curr = currencyMap.get(currency) || { records: 0, totalLocal: 0, totalUSD: 0, rateSum: 0 };
      curr.records++;
      curr.totalLocal += amount;
      curr.totalUSD += amountUSD;
      curr.rateSum += rate;
      currencyMap.set(currency, curr);
    }
  }

  // Build GL comparison
  const glMap = new Map<string, number>();
  if (glFile && glMapping) {
    const glFeeCodeCol = glMapping["Fee Code"];
    const glAmountCol = glMapping["GL Amount (USD)"];
    if (glFeeCodeCol && glAmountCol) {
      for (const row of glFile.data) {
        const feeCode = String(row[glFeeCodeCol] || "").trim();
        const amount = parseFloat(String(row[glAmountCol] || "0").replace(/,/g, ""));
        if (feeCode && !isNaN(amount)) {
          glMap.set(feeCode, (glMap.get(feeCode) || 0) + amount);
        }
      }
    }
  }

  // Build summary
  const summary: SummaryRow[] = Array.from(feeCodeMap.entries()).map(([feeCode, data]) => {
    const row: SummaryRow = { feeCode, records: data.records, sumFeeAmountUSD: Math.round(data.sumUSD * 100) / 100 };
    if (glMap.has(feeCode)) {
      row.glAmountUSD = Math.round(glMap.get(feeCode)! * 100) / 100;
      row.difference = Math.round((row.sumFeeAmountUSD - row.glAmountUSD) * 100) / 100;
      row.differencePercent = row.glAmountUSD !== 0 ? Math.round((Math.abs(row.difference) / Math.abs(row.glAmountUSD)) * 10000) / 100 : 0;
      row.status = Math.abs(row.differencePercent) < 0.01 ? "match" : Math.abs(row.differencePercent) < 5 ? "minor" : "mismatch";
    }
    return row;
  }).sort((a, b) => a.feeCode.localeCompare(b.feeCode));

  // Build detailed
  const detailed: DetailedRow[] = Array.from(detailedMap.values()).map((d) => ({
    feeCode: d.feeCode, currency: d.currency, records: d.records,
    sumFeeAmount: Math.round(d.sumLocal * 100) / 100,
    sumFeeAmountUSD: Math.round(d.sumUSD * 100) / 100,
  })).sort((a, b) => a.feeCode.localeCompare(b.feeCode) || a.currency.localeCompare(b.currency));

  // Build currency totals
  const currencyTotals = Array.from(currencyMap.entries()).map(([currency, data]) => ({
    currency, records: data.records,
    totalLocal: Math.round(data.totalLocal * 100) / 100,
    totalUSD: Math.round(data.totalUSD * 100) / 100,
    avgRate: data.records > 0 ? data.rateSum / data.records : 0,
  })).sort((a, b) => b.totalUSD - a.totalUSD);

  const uniqueCurrencies = new Set(detailed.map((d) => d.currency));

  return {
    summary, detailed, totalRecords, totalAmountUSD: Math.round(totalUSD * 100) / 100,
    feeCodesCount: feeCodeMap.size, currenciesCount: uniqueCurrencies.size,
    currencyTotals, errors, grandTotalUSD: Math.round(totalUSD * 100) / 100,
    exchangeRateUsed: true,
  };
}
