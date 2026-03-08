export interface SystemField {
  name: string;
  description: string;
  type: "text" | "numeric" | "date";
  required: boolean;
  examples: string;
}

export interface FileData {
  name: string;
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
}

export interface ColumnMapping {
  [systemField: string]: string | null;
}

export interface FileMappingState {
  [filename: string]: ColumnMapping;
}

export interface AutoDetectResult {
  mapping: ColumnMapping;
  confidence: { [systemField: string]: number };
}

export interface SummaryRow {
  feeCode: string;
  records: number;
  sumFeeAmountUSD: number;
  glAmountUSD?: number;
  difference?: number;
  differencePercent?: number;
  status?: "match" | "minor" | "mismatch";
}

export interface DetailedRow {
  feeCode: string;
  currency: string;
  records: number;
  sumFeeAmount: number;
  sumFeeAmountUSD: number;
}

export interface ProcessingResults {
  summary: SummaryRow[];
  detailed: DetailedRow[];
  totalRecords: number;
  totalAmountUSD: number;
  feeCodesCount: number;
  currenciesCount: number;
}

export interface SavedMapping {
  id: string;
  name: string;
  mapping: ColumnMapping;
  savedAt: string;
}

export type AppStep = 1 | 2 | 3 | 4;
