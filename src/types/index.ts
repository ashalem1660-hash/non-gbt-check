export type AppStep = 1 | 2 | 3 | 4;

export interface FileData {
  name: string;
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
}

export interface ColumnMapping {
  [fieldName: string]: string | null;
}

export interface SavedMapping {
  id: string;
  name: string;
  mapping: ColumnMapping;
  savedAt: string;
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

export interface LoadingState {
  isLoading: boolean;
  stage: string;
  progress: number;
  detail: string;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  field: string;
  message: string;
  suggestion?: string;
}

export interface FileValidation {
  fileName: string;
  issues: ValidationIssue[];
  isValid: boolean;
  stats: {
    totalRows: number;
    emptyRows: number;
    uniqueValues: Record<string, number>;
    nullCounts: Record<string, number>;
    sampleValues: Record<string, string[]>;
  };
}
