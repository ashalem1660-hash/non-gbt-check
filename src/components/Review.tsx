"use client";

import React from "react";
import type { FileData, ColumnMapping } from "../types";

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

function MappingSummary({ label, mapping }: { label: string; mapping: ColumnMapping }) {
  const entries = Object.entries(mapping);
  const mapped = entries.filter(([, v]) => v !== null);
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={mapped.length === entries.length ? "text-green-500" : "text-amber-500"}>{mapped.length === entries.length ? "OK" : "!"}</span>
        <h4 className="font-semibold text-gray-800">{label}</h4>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{mapped.length}/{entries.length} mapped</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([field, col]) => (
          <div key={field} className="flex items-center gap-2 text-sm">
            <span className={col ? "text-green-600" : "text-red-400"}>{col ? "Y" : "X"}</span>
            <span className="text-gray-600">{field}</span>
            <span className="text-gray-400">&rarr;</span>
            <span className={col ? "font-medium text-gray-800" : "text-red-400 italic"}>{col || "Not mapped"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Review({ feeFiles, exchangeFile, glFile, feeMappings, exchangeMapping, glMapping, onProcess, onBack }: ReviewProps) {
  const totalRows = feeFiles.reduce((sum, f) => sum + f.rowCount, 0);
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Review and Process</h2>
        <p className="text-gray-500 mt-1">Verify everything looks correct before processing</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-blue-700">{feeFiles.length}</p>
          <p className="text-sm text-blue-600 mt-1">Fee Files</p>
        </div>
        <div className="bg-green-50 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-green-700">{totalRows.toLocaleString()}</p>
          <p className="text-sm text-green-600 mt-1">Total Rows</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-purple-700">{glFile ? "Yes" : "No"}</p>
          <p className="text-sm text-purple-600 mt-1">GL Comparison</p>
        </div>
      </div>
      <div className="space-y-4 mb-8">
        <h3 className="text-lg font-semibold text-gray-700">Mapping Summary</h3>
        {feeFiles.map((f) => (<MappingSummary key={f.name} label={"Fee: " + f.name} mapping={feeMappings[f.name] || {}} />))}
        <MappingSummary label={"Exchange: " + exchangeFile.name} mapping={exchangeMapping} />
        {glFile && <MappingSummary label={"GL: " + glFile.name} mapping={glMapping} />}
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back</button>
        <button onClick={onProcess} className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 shadow-md hover:shadow-lg transition-colors text-lg">Process Data</button>
      </div>
    </div>
  );
}
