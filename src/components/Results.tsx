"use client";

import React, { useState } from "react";
import type { ProcessingResults } from "../types";
import type { EnhancedProcessingResults } from "../lib/processing";
import * as XLSX from "xlsx";

interface ResultsProps {
  results: ProcessingResults;
  onBack: () => void;
  onReset: () => void;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "match") return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Match</span>;
  if (status === "minor") return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Minor Diff</span>;
  if (status === "mismatch") return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Mismatch</span>;
  return <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">N/A</span>;
}

export default function Results({ results: rawResults, onBack, onReset }: ResultsProps) {
  const results = rawResults as EnhancedProcessingResults;
  const [view, setView] = useState<"summary" | "detailed" | "currency" | "errors">("summary");

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryWS = XLSX.utils.json_to_sheet(results.summary.map((r) => ({
      "Fee Code": r.feeCode, "Records": r.records, "Sum Fee Amount (USD)": r.sumFeeAmountUSD,
      "GL Amount (USD)": r.glAmountUSD ?? "", "Difference": r.difference ?? "",
      "Difference %": r.differencePercent !== undefined ? r.differencePercent + "%" : "", "Status": r.status ?? ""
    })));
    XLSX.utils.book_append_sheet(wb, summaryWS, "Summary by Fee Code");
    const detailedWS = XLSX.utils.json_to_sheet(results.detailed.map((r) => ({
      "Fee Code": r.feeCode, "Currency": r.currency, "Records": r.records,
      "Sum Local Amount": r.sumFeeAmount, "Sum USD Amount": r.sumFeeAmountUSD
    })));
    XLSX.utils.book_append_sheet(wb, detailedWS, "Detailed by Currency");
    if (results.currencyTotals) {
      const currWS = XLSX.utils.json_to_sheet(results.currencyTotals.map((c) => ({
        "Currency": c.currency, "Records": c.records, "Total Local": c.totalLocal,
        "Total USD": c.totalUSD, "Avg Rate": c.avgRate
      })));
      XLSX.utils.book_append_sheet(wb, currWS, "Currency Totals");
    }
    if (results.errors && results.errors.length > 0) {
      const errWS = XLSX.utils.json_to_sheet(results.errors.map((e) => ({
        "Row": e.row, "File": e.file, "Fee Code": e.feeCode, "Currency": e.currency,
        "Date": e.date, "Error": e.message
      })));
      XLSX.utils.book_append_sheet(wb, errWS, "Errors");
    }
    XLSX.writeFile(wb, "NonGBT_Results_" + new Date().toISOString().slice(0, 10) + ".xlsx");
  };

  const matches = results.summary.filter((r) => r.status === "match").length;
  const mismatches = results.summary.filter((r) => r.status === "mismatch").length;
  const minors = results.summary.filter((r) => r.status === "minor").length;
  const hasGL = results.summary.some((r) => r.glAmountUSD !== undefined);
  const errorCount = results.errors?.length || 0;

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Processing Results</h2>
        <p className="text-gray-500 mt-1">Complete analysis of fee transactions with exchange rate conversion</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100"><p className="text-2xl font-bold text-blue-700">{results.totalRecords.toLocaleString()}</p><p className="text-xs text-blue-600 mt-1">Total Records Processed</p></div>
        <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100"><p className="text-2xl font-bold text-green-700">${results.grandTotalUSD?.toLocaleString() || results.totalAmountUSD.toLocaleString()}</p><p className="text-xs text-green-600 mt-1">Grand Total (USD)</p></div>
        <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100"><p className="text-2xl font-bold text-purple-700">{results.feeCodesCount}</p><p className="text-xs text-purple-600 mt-1">Unique Fee Codes</p></div>
        <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100"><p className="text-2xl font-bold text-amber-700">{results.currenciesCount}</p><p className="text-xs text-amber-600 mt-1">Currencies</p></div>
      </div>
      {hasGL && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-green-700">{matches}</p><p className="text-sm text-green-600">Matches</p></div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-amber-700">{minors}</p><p className="text-sm text-amber-600">Minor Differences</p></div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-red-700">{mismatches}</p><p className="text-sm text-red-600">Mismatches</p></div>
        </div>
      )}
      {errorCount > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 font-bold text-lg">!</span>
            <h3 className="font-semibold text-red-800">Attention: {errorCount} issue{errorCount > 1 ? "s" : ""} found</h3>
          </div>
          <p className="text-sm text-red-700">Some transactions could not be processed. Common causes:</p>
          <ul className="text-sm text-red-600 mt-1 ml-4 list-disc">
            <li>Missing exchange rate for specific currency/date combination</li>
            <li>Invalid or missing fee amounts</li>
            <li>Missing fee codes or currency codes</li>
          </ul>
          <button onClick={() => setView("errors")} className="mt-2 text-sm text-red-700 font-semibold underline hover:text-red-900">View all errors</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setView("summary")} className={"px-4 py-2 rounded-lg text-sm font-medium transition-colors " + (view === "summary" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>Summary by Fee Code</button>
          <button onClick={() => setView("detailed")} className={"px-4 py-2 rounded-lg text-sm font-medium transition-colors " + (view === "detailed" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>Detailed by Currency</button>
          <button onClick={() => setView("currency")} className={"px-4 py-2 rounded-lg text-sm font-medium transition-colors " + (view === "currency" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>Currency Totals</button>
          {errorCount > 0 && (<button onClick={() => setView("errors")} className={"px-4 py-2 rounded-lg text-sm font-medium transition-colors " + (view === "errors" ? "bg-red-600 text-white" : "bg-red-100 text-red-600 hover:bg-red-200")}>Errors ({errorCount})</button>)}
        </div>
        <button onClick={exportToExcel} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm">Export to Excel</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          {view === "summary" && (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Fee Code</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Records</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total (USD)</th>
                {hasGL && <th className="px-4 py-3 text-right font-semibold text-gray-700">GL (USD)</th>}
                {hasGL && <th className="px-4 py-3 text-right font-semibold text-gray-700">Difference</th>}
                {hasGL && <th className="px-4 py-3 text-right font-semibold text-gray-700">Diff %</th>}
                {hasGL && <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>}
              </tr></thead>
              <tbody>
                {results.summary.map((row) => (
                  <tr key={row.feeCode} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.feeCode}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.records.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">${row.sumFeeAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    {hasGL && <td className="px-4 py-3 text-right">{row.glAmountUSD !== undefined ? "$" + row.glAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>}
                    {hasGL && <td className={"px-4 py-3 text-right font-medium " + (row.difference && row.difference > 0 ? "text-red-600" : row.difference && row.difference < 0 ? "text-blue-600" : "text-green-600")}>{row.difference !== undefined ? "$" + row.difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>}
                    {hasGL && <td className="px-4 py-3 text-right text-gray-600">{row.differencePercent !== undefined ? row.differencePercent.toFixed(2) + "%" : "-"}</td>}
                    {hasGL && <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>}
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-gray-800">TOTAL</td>
                  <td className="px-4 py-3 text-right text-gray-800">{results.summary.reduce((s, r) => s + r.records, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-800">${results.summary.reduce((s, r) => s + r.sumFeeAmountUSD, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  {hasGL && <td className="px-4 py-3 text-right text-gray-800">${results.summary.reduce((s, r) => s + (r.glAmountUSD || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                  {hasGL && <td className="px-4 py-3 text-right text-gray-800">${results.summary.reduce((s, r) => s + (r.difference || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                  {hasGL && <td className="px-4 py-3"></td>}
                  {hasGL && <td className="px-4 py-3"></td>}
                </tr>
              </tbody>
            </table>
          )}
          {view === "detailed" && (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Fee Code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Currency</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Records</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Sum (Local)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Sum (USD)</th>
              </tr></thead>
              <tbody>
                {results.detailed.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.feeCode}</td>
                    <td className="px-4 py-3 text-gray-600">{row.currency}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.records.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{row.sumFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-medium">${row.sumFeeAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-gray-800" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-3 text-right text-gray-800">{results.detailed.reduce((s, r) => s + r.records, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-800">-</td>
                  <td className="px-4 py-3 text-right text-gray-800">${results.detailed.reduce((s, r) => s + r.sumFeeAmountUSD, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          )}
          {view === "currency" && results.currencyTotals && (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Currency</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Records</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total (Local)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Avg Rate</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total (USD)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">% of Total</th>
              </tr></thead>
              <tbody>
                {results.currencyTotals.map((row) => (
                  <tr key={row.currency} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.currency}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.records.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{row.totalLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.avgRate.toFixed(6)}</td>
                    <td className="px-4 py-3 text-right font-medium">${row.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{results.grandTotalUSD ? ((row.totalUSD / results.grandTotalUSD) * 100).toFixed(1) + "%" : "-"}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-gray-800">TOTAL</td>
                  <td className="px-4 py-3 text-right text-gray-800">{results.currencyTotals.reduce((s, r) => s + r.records, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-800">-</td>
                  <td className="px-4 py-3 text-right text-gray-800">-</td>
                  <td className="px-4 py-3 text-right text-gray-800">${(results.grandTotalUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-gray-800">100%</td>
                </tr>
              </tbody>
            </table>
          )}
          {view === "errors" && results.errors && (
            <table className="w-full text-sm">
              <thead><tr className="bg-red-50 border-b border-red-200">
                <th className="px-4 py-3 text-left font-semibold text-red-700">Row</th>
                <th className="px-4 py-3 text-left font-semibold text-red-700">File</th>
                <th className="px-4 py-3 text-left font-semibold text-red-700">Fee Code</th>
                <th className="px-4 py-3 text-left font-semibold text-red-700">Currency</th>
                <th className="px-4 py-3 text-left font-semibold text-red-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-red-700">Error</th>
              </tr></thead>
              <tbody>
                {results.errors.map((err, i) => (
                  <tr key={i} className="border-b border-red-100 hover:bg-red-50">
                    <td className="px-4 py-3 text-gray-700">{err.row}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{err.file}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{err.feeCode}</td>
                    <td className="px-4 py-3 text-gray-600">{err.currency}</td>
                    <td className="px-4 py-3 text-gray-600">{err.date || "-"}</td>
                    <td className="px-4 py-3 text-red-700 text-xs">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {results.exchangeRateUsed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 font-medium">Exchange Rate Method: Daily rates by transaction date</p>
          <p className="text-xs text-blue-600 mt-1">Each transaction was converted using the exchange rate matching its transaction date. If an exact date match was not found, the nearest available rate (up to 7 days) was used.</p>
        </div>
      )}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back to Review</button>
        <button onClick={onReset} className="px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800">Start New Check</button>
      </div>
    </div>
  );
}
