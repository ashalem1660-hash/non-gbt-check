"use client";

import React, { useState, useEffect } from "react";
import type { FileData, ColumnMapping, LoadingState, FileValidation, ValidationIssue } from "../types";

function validateFile(file: FileData, mapping: ColumnMapping, fileType: "fee" | "exchange" | "gl"): FileValidation {
  const issues: ValidationIssue[] = [];
  const stats = {
    totalRows: file.rowCount,
    emptyRows: 0,
    uniqueValues: {} as Record<string, number>,
    nullCounts: {} as Record<string, number>,
    sampleValues: {} as Record<string, string[]>,
  };
  // Check null counts and samples for each mapped column
  for (const [field, col] of Object.entries(mapping)) {
    if (!col) continue;
    let nullCount = 0;
    const uniqueSet = new Set<string>();
    const samples: string[] = [];
    for (const row of file.data) {
      const val = row[col];
      if (val === null || val === undefined || String(val).trim() === "") {
        nullCount++;
      } else {
        const str = String(val).trim();
        uniqueSet.add(str);
        if (samples.length < 5) samples.push(str);
      }
    }
    stats.nullCounts[field] = nullCount;
    stats.uniqueValues[field] = uniqueSet.size;
    stats.sampleValues[field] = samples;
    if (nullCount > 0) {
      const pct = Math.round((nullCount / file.rowCount) * 100);
      if (pct > 50) {
        issues.push({ severity: "error", field, message: field + " has " + nullCount + " empty values (" + pct + "% of rows). This column may be incorrectly mapped.", suggestion: "Check if the correct column is mapped to " + field });
      } else if (pct > 10) {
        issues.push({ severity: "warning", field, message: field + " has " + nullCount + " empty values (" + pct + "%). These rows will be skipped during processing.", suggestion: "Verify your source data for missing " + field + " values" });
      } else if (nullCount > 0) {
        issues.push({ severity: "info", field, message: field + " has " + nullCount + " empty value" + (nullCount > 1 ? "s" : "") + ". These rows will be skipped." });
      }
    }
  }
  // Fee-specific validations
  if (fileType === "fee") {
    const amountCol = mapping["Fee Amount"];
    if (amountCol) {
      let invalidAmounts = 0;
      for (const row of file.data) {
        const val = String(row[amountCol] || "").replace(/,/g, "");
        if (val && isNaN(parseFloat(val))) invalidAmounts++;
      }
      if (invalidAmounts > 0) {
        issues.push({ severity: "error", field: "Fee Amount", message: invalidAmounts + " rows have non-numeric fee amounts. These cannot be processed.", suggestion: "Check for text values, special characters, or formatting issues in the amount column" });
      }
    }
    const currCol = mapping["Currency"];
    if (currCol) {
      const currencies = new Set<string>();
      for (const row of file.data) {
        const val = String(row[currCol] || "").trim().toUpperCase();
        if (val) currencies.add(val);
      }
      issues.push({ severity: "info", field: "Currency", message: "Found " + currencies.size + " unique currencies: " + Array.from(currencies).sort().join(", ") });
    }
  }
  // Exchange rate specific validations
  if (fileType === "exchange") {
    const rateCol = mapping["Exchange Rate"];
    if (rateCol) {
      let zeroRates = 0, negativeRates = 0;
      for (const row of file.data) {
        const val = parseFloat(String(row[rateCol] || "0"));
        if (val === 0) zeroRates++;
        if (val < 0) negativeRates++;
      }
      if (zeroRates > 0) issues.push({ severity: "warning", field: "Exchange Rate", message: zeroRates + " rows have zero exchange rate. These currencies will result in zero USD amounts." });
      if (negativeRates > 0) issues.push({ severity: "error", field: "Exchange Rate", message: negativeRates + " rows have negative exchange rates. This is likely an error." });
    }
    const dateCol = mapping["Rate Date"];
    if (dateCol) {
      const dates = new Set<string>();
      for (const row of file.data) {
        const val = String(row[dateCol] || "").trim();
        if (val) dates.add(val.slice(0, 10));
      }
      const currencies = new Set<string>();
      const currCol = mapping["Currency Code"];
      if (currCol) {
        for (const row of file.data) {
          const val = String(row[currCol] || "").trim().toUpperCase();
          if (val) currencies.add(val);
        }
      }
      issues.push({ severity: "info", field: "Rate Date", message: "Exchange rate file covers " + dates.size + " unique dates and " + currencies.size + " currencies (" + file.rowCount + " rate entries total)" });
    }
  }
  const hasErrors = issues.some((i) => i.severity === "error");
  return { fileName: file.name, issues, isValid: !hasErrors, stats };
}

function IssueIcon({ severity }: { severity: string }) {
  if (severity === "error") return <span className="text-red-500 font-bold">&#10060;</span>;
  if (severity === "warning") return <span className="text-amber-500 font-bold">&#9888;</span>;
  return <span className="text-blue-500">&#8505;</span>;
}

interface ReviewProps {
  feeFiles: FileData[];
  exchangeFile: FileData;
  glFile: FileData | null;
  feeMappings: Record<string, ColumnMapping>;
  exchangeMapping: ColumnMapping;
  glMapping: ColumnMapping;
  onProcess: () => void;
  onBack: () => void;
}

export default function Review({ feeFiles, exchangeFile, glFile, feeMappings, exchangeMapping, glMapping, onProcess, onBack }: ReviewProps) {
  const [validations, setValidations] = useState<FileValidation[]>([]);
  const [loading, setLoading] = useState<LoadingState>({ isLoading: true, stage: "Validating data...", progress: 0, detail: "" });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const run = async () => {
      const results: FileValidation[] = [];
      const allFiles = [...feeFiles.map((f, i) => ({ file: f, mapping: feeMappings[f.name] || {}, type: "fee" as const, idx: i })), { file: exchangeFile, mapping: exchangeMapping, type: "exchange" as const, idx: 0 }, ...(glFile ? [{ file: glFile, mapping: glMapping, type: "gl" as const, idx: 0 }] : [])];
      for (let i = 0; i < allFiles.length; i++) {
        const { file, mapping, type } = allFiles[i];
        setLoading({ isLoading: true, stage: "Validating " + file.name + "...", progress: Math.round(((i + 1) / allFiles.length) * 100), detail: "File " + (i + 1) + " of " + allFiles.length });
        await new Promise((r) => setTimeout(r, 200));
        results.push(validateFile(file, mapping, type));
      }
      setValidations(results);
      setLoading({ isLoading: false, stage: "", progress: 100, detail: "" });
    };
    run();
  }, [feeFiles, exchangeFile, glFile, feeMappings, exchangeMapping, glMapping]);

  const handleProcess = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 100));
    onProcess();
  };

  const totalErrors = validations.reduce((s, v) => s + v.issues.filter((i) => i.severity === "error").length, 0);
  const totalWarnings = validations.reduce((s, v) => s + v.issues.filter((i) => i.severity === "warning").length, 0);
  const allValid = validations.every((v) => v.isValid);
  const totalRows = feeFiles.reduce((s, f) => s + f.rowCount, 0);

  if (loading.isLoading) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">{loading.stage}</h2>
        <p className="text-gray-500">{loading.detail}</p>
        <div className="w-64 mx-auto mt-4 bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: loading.progress + "%" }}></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Review & Validate</h2>
        <p className="text-gray-500 mt-1">Review your data before processing. Fix any errors before continuing.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100"><p className="text-2xl font-bold text-blue-700">{totalRows.toLocaleString()}</p><p className="text-xs text-blue-600 mt-1">Total Fee Rows</p></div>
        <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100"><p className="text-2xl font-bold text-purple-700">{exchangeFile.rowCount.toLocaleString()}</p><p className="text-xs text-purple-600 mt-1">Exchange Rate Entries</p></div>
        <div className={"rounded-xl p-4 text-center border " + (totalErrors > 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100")}><p className={"text-2xl font-bold " + (totalErrors > 0 ? "text-red-700" : "text-green-700")}>{totalErrors}</p><p className={"text-xs mt-1 " + (totalErrors > 0 ? "text-red-600" : "text-green-600")}>Errors</p></div>
        <div className={"rounded-xl p-4 text-center border " + (totalWarnings > 0 ? "bg-amber-50 border-amber-100" : "bg-green-50 border-green-100")}><p className={"text-2xl font-bold " + (totalWarnings > 0 ? "text-amber-700" : "text-green-700")}>{totalWarnings}</p><p className={"text-xs mt-1 " + (totalWarnings > 0 ? "text-amber-600" : "text-green-600")}>Warnings</p></div>
      </div>
      {totalErrors > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-red-800 mb-1">Errors Found</h3>
          <p className="text-sm text-red-700">There are {totalErrors} error(s) in your data. You can still proceed, but affected rows will be skipped. Consider fixing these issues for complete results.</p>
        </div>
      )}
      <div className="space-y-4 mb-8">
        {validations.map((val) => (
          <div key={val.fileName} className={"bg-white rounded-xl border p-5 " + (val.isValid ? "border-green-200" : "border-red-200")}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={"w-2.5 h-2.5 rounded-full " + (val.isValid ? "bg-green-500" : "bg-red-500")}></span>
                <h3 className="font-semibold text-gray-800">{val.fileName}</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{val.stats.totalRows.toLocaleString()} rows</span>
              </div>
              <span className={"text-xs px-2 py-1 rounded-full font-medium " + (val.isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{val.isValid ? "Valid" : "Has errors"}</span>
            </div>
            {val.issues.length > 0 && (
              <div className="space-y-2">
                {val.issues.map((issue, i) => (
                  <div key={i} className={"rounded-lg p-3 " + (issue.severity === "error" ? "bg-red-50 border border-red-200" : issue.severity === "warning" ? "bg-amber-50 border border-amber-200" : "bg-blue-50 border border-blue-200")}>
                    <div className="flex items-start gap-2">
                      <IssueIcon severity={issue.severity} />
                      <div>
                        <p className={"text-sm font-medium " + (issue.severity === "error" ? "text-red-800" : issue.severity === "warning" ? "text-amber-800" : "text-blue-800")}>{issue.field}: {issue.message}</p>
                        {issue.suggestion && <p className={"text-xs mt-0.5 " + (issue.severity === "error" ? "text-red-600" : issue.severity === "warning" ? "text-amber-600" : "text-blue-600")}>Suggestion: {issue.suggestion}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {val.issues.length === 0 && <p className="text-sm text-green-600">All validations passed.</p>}
          </div>
        ))}
      </div>
      {totalRows > 20000 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-amber-800 text-sm font-medium">Large dataset detected ({totalRows.toLocaleString()} rows)</p>
          <p className="text-amber-600 text-xs mt-1">Processing may take a few seconds. Please wait for it to complete.</p>
        </div>
      )}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back to Mapping</button>
        {processing ? (
          <div className="flex items-center gap-3 px-8 py-3 bg-blue-500 text-white rounded-lg">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="font-medium">Processing {totalRows.toLocaleString()} rows...</span>
          </div>
        ) : (
          <button onClick={handleProcess} className={"px-8 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-lg " + (allValid ? "bg-green-600 text-white hover:bg-green-700" : "bg-amber-600 text-white hover:bg-amber-700")}>{allValid ? "Process Data" : "Process Anyway (skip errors)"}</button>
        )}
      </div>
    </div>
  );
}
