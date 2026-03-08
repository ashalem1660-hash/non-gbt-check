"use client";

import React, { useState } from "react";
import type { ProcessingResults } from "../types";
import * as XLSX from "xlsx";

interface ResultsProps {
  results: ProcessingResults;
  onBack: () => void;
  onReset: () => void;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "match") return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Match</span>;
  if (status === "minor") return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Minor</span>;
  if (status === "mismatch") return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Mismatch</span>;
  return <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">N/A</span>;
}

export default function Results({ results, onBack, onReset }: ResultsProps) {
  const [view, setView] = useState<"summary" | "detailed">("summary");

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryWS = XLSX.utils.json_to_sheet(results.summary.map((r) => ({ "Fee Code": r.feeCode, "Records": r.records, "Sum Fee Amount (USD)": r.sumFeeAmountUSD, "GL Amount (USD)": r.glAmountUSD ?? "", "Difference": r.difference ?? "", "Difference Percent": r.differencePercent ? r.differencePercent + "%" : "", "Status": r.status ?? "" })));
    XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");
    const detailedWS = XLSX.utils.json_to_sheet(results.detailed.map((r) => ({ "Fee Code": r.feeCode, "Currency": r.currency, "Records": r.records, "Sum Fee Amount": r.sumFeeAmount, "Sum Fee Amount (USD)": r.sumFeeAmountUSD })));
    XLSX.utils.book_append_sheet(wb, detailedWS, "Detailed");
    XLSX.writeFile(wb, "NonGBT_Results_" + new Date().toISOString().slice(0, 10) + ".xlsx");
  };

  const matches = results.summary.filter((r) => r.status === "match").length;
  const mismatches = results.summary.filter((r) => r.status === "mismatch").length;
  const hasGL = results.summary.some((r) => r.glAmountUSD !== undefined);

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Results</h2>
        <p className="text-gray-500 mt-1">Processing complete! Here are your results.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-700">{results.totalRecords.toLocaleString()}</p><p className="text-xs text-blue-600">Total Records</p></div>
        <div className="bg-green-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-green-700">${results.totalAmountUSD.toLocaleString()}</p><p className="text-xs text-green-600">Total Amount (USD)</p></div>
        <div className="bg-purple-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-purple-700">{results.feeCodesCount}</p><p className="text-xs text-purple-600">Fee Codes</p></div>
        <div className="bg-amber-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-amber-700">{results.currenciesCount}</p><p className="text-xs text-amber-600">Currencies</p></div>
      </div>
      {hasGL && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-green-700">{matches}</p><p className="text-sm text-green-600">GL Matches</p></div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-red-700">{mismatches}</p><p className="text-sm text-red-600">Mismatches</p></div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={() => setView("summary")} className={"px-4 py-2 rounded-lg text-sm font-medium " + (view === "summary" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>Summary</button>
          <button onClick={() => setView("detailed")} className={"px-4 py-2 rounded-lg text-sm font-medium " + (view === "detailed" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>Detailed</button>
        </div>
        <button onClick={exportToExcel} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Export Excel</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          {view === "summary" ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Fee Code</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Records</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Sum (USD)</th>
                {hasGL && <th className="px-4 py-3 text-right font-semibold text-gray-700">GL (USD)</th>}
                {hasGL && <th className="px-4 py-3 text-right font-semibold text-gray-700">Diff</th>}
                {hasGL && <th className="px-4 py-3 text-right font-semibold text-gray-700">Diff %</th>}
                {hasGL && <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>}
              </tr></thead>
              <tbody>{results.summary.map((row) => (
                <tr key={row.feeCode} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{row.feeCode}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.records.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium">${row.sumFeeAmountUSD.toLocaleString()}</td>
                  {hasGL && <td className="px-4 py-3 text-right">{row.glAmountUSD !== undefined ? "$" + row.glAmountUSD.toLocaleString() : "-"}</td>}
                  {hasGL && <td className="px-4 py-3 text-right font-medium">{row.difference !== undefined ? "$" + row.difference.toLocaleString() : "-"}</td>}
                  {hasGL && <td className="px-4 py-3 text-right text-gray-600">{row.differencePercent !== undefined ? row.differencePercent + "%" : "-"}</td>}
                  {hasGL && <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>}
                </tr>
              ))}</tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Fee Code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Currency</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Records</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Sum (Local)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Sum (USD)</th>
              </tr></thead>
              <tbody>{results.detailed.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{row.feeCode}</td>
                  <td className="px-4 py-3 text-gray-600">{row.currency}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.records.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{row.sumFeeAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium">${row.sumFeeAmountUSD.toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back</button>
        <button onClick={onReset} className="px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800">Start New Check</button>
      </div>
    </div>
  );
}
