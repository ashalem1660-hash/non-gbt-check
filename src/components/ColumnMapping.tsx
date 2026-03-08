"use client";

import React, { useEffect, useState } from "react";
import type { FileData, ColumnMapping as ColumnMappingType, SavedMapping } from "../types";
import { autoDetectMapping } from "../lib/fuzzyMatch";

const FEE_FIELDS = [
  { name: "Fee Code", description: "Fee code identifier", required: true, examples: "3004, 3032" },
  { name: "Fee Amount", description: "Transaction amount", required: true, examples: "150.00, -23.50" },
  { name: "Currency", description: "Currency code", required: true, examples: "USD, EUR, GBP" },
  { name: "Transaction Date", description: "Date of transaction", required: false, examples: "2025-01-15" },
];

const EXCHANGE_FIELDS = [
  { name: "Currency Code", description: "Currency code", required: true, examples: "USD, EUR" },
  { name: "Exchange Rate", description: "Average exchange rate", required: true, examples: "1.0, 0.92" },
];

const GL_FIELDS = [
  { name: "Fee Code", description: "Fee code identifier", required: true, examples: "3004, 3032" },
  { name: "GL Amount (USD)", description: "Ledger amount in USD", required: true, examples: "45230.00" },
];

function getPreview(data: Record<string, unknown>[], column: string): string {
  return data.slice(0, 4).map((row) => String(row[column] ?? "")).filter(Boolean).join(", ");
}

function MappingCard({ file, fields, mapping, confidence, onChange }: {
  file: FileData;
  fields: { name: string; description: string; required: boolean; examples: string }[];
  mapping: ColumnMappingType;
  confidence: Record<string, number>;
  onChange: (field: string, value: string | null) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800">{file.name}</h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{file.rowCount} rows | {file.columns.length} cols</span>
        </div>
        <button onClick={() => setShowPreview(!showPreview)} className="text-sm text-blue-600 hover:text-blue-800">
          {showPreview ? "Hide Preview" : "Show Preview"}
        </button>
      </div>
      {showPreview && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-gray-50">{file.columns.map((col) => (<th key={col} className="border border-gray-200 px-2 py-1 text-left font-medium text-gray-600">{col}</th>))}</tr></thead>
            <tbody>{file.data.slice(0, 3).map((row, i) => (<tr key={i}>{file.columns.map((col) => (<td key={col} className="border border-gray-200 px-2 py-1 text-gray-700">{String(row[col] ?? "")}</td>))}</tr>))}</tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => {
          const conf = confidence[field.name] || 0;
          const bgColor = conf >= 0.8 ? "bg-green-50" : conf >= 0.5 ? "bg-amber-50" : "bg-gray-50";
          const confText = conf >= 0.8 ? "Auto-detected" : conf >= 0.5 ? "Possible match" : "";
          const confColor = conf >= 0.8 ? "text-green-600" : "text-amber-600";
          return (
            <div key={field.name} className={"rounded-lg border p-3 " + bgColor + " border-gray-200"}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-gray-800">{field.name}</span>
                  {field.required && <span className="text-red-500 text-xs font-bold">*</span>}
                </div>
                {conf > 0 && <span className={"text-xs font-medium " + confColor}>{confText} ({Math.round(conf * 100)}%)</span>}
              </div>
              <p className="text-xs text-gray-500 mb-2">{field.description} - e.g. {field.examples}</p>
              <select value={mapping[field.name] || ""} onChange={(e) => onChange(field.name, e.target.value || null)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">-- Select column --</option>
                {file.columns.map((col) => (<option key={col} value={col}>{col}</option>))}
              </select>
              {mapping[field.name] && <p className="text-xs text-gray-500 mt-1 italic">Values: {getPreview(file.data, mapping[field.name]!)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ColumnMappingProps {
  feeFiles: FileData[];
  exchangeFile: FileData;
  glFile: FileData | null;
  feeMappings: Record<string, ColumnMappingType>;
  exchangeMapping: ColumnMappingType;
  glMapping: ColumnMappingType;
  onFeeMappingsChange: (m: Record<string, ColumnMappingType>) => void;
  onExchangeMappingChange: (m: ColumnMappingType) => void;
  onGlMappingChange: (m: ColumnMappingType) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ColumnMapping({ feeFiles, exchangeFile, glFile, feeMappings, exchangeMapping, glMapping, onFeeMappingsChange, onExchangeMappingChange, onGlMappingChange, onNext, onBack }: ColumnMappingProps) {
  const [saveName, setSaveName] = useState("");
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);

  useEffect(() => {
    const newFee: Record<string, ColumnMappingType> = {};
    for (const file of feeFiles) {
      if (!feeMappings[file.name]) {
        const { mapping } = autoDetectMapping(FEE_FIELDS.map((f) => f.name), file.columns);
        newFee[file.name] = mapping;
      } else { newFee[file.name] = feeMappings[file.name]; }
    }
    onFeeMappingsChange(newFee);
    if (Object.keys(exchangeMapping).length === 0) {
      const { mapping } = autoDetectMapping(EXCHANGE_FIELDS.map((f) => f.name), exchangeFile.columns);
      onExchangeMappingChange(mapping);
    }
    if (glFile && Object.keys(glMapping).length === 0) {
      const { mapping } = autoDetectMapping(GL_FIELDS.map((f) => f.name), glFile.columns);
      onGlMappingChange(mapping);
    }
    const saved = localStorage.getItem("savedMappings");
    if (saved) setSavedMappings(JSON.parse(saved));
  }, []);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const newM: SavedMapping = { id: Date.now().toString(), name: saveName, mapping: feeMappings[feeFiles[0]?.name] || {}, savedAt: new Date().toLocaleString() };
    const updated = [...savedMappings, newM];
    setSavedMappings(updated);
    localStorage.setItem("savedMappings", JSON.stringify(updated));
    setSaveName("");
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Column Mapping</h2>
        <p className="text-gray-500 mt-1">Map your file columns to system fields. We auto-detect when possible!</p>
      </div>
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Fee Files Mapping</h3>
        <div className="space-y-6">
          {feeFiles.map((file) => {
            const { confidence } = autoDetectMapping(FEE_FIELDS.map((f) => f.name), file.columns);
            return (<MappingCard key={file.name} file={file} fields={FEE_FIELDS} mapping={feeMappings[file.name] || {}} confidence={confidence} onChange={(field, value) => { onFeeMappingsChange({ ...feeMappings, [file.name]: { ...feeMappings[file.name], [field]: value } }); }} />);
          })}
        </div>
      </div>
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Exchange Rate Mapping</h3>
        <MappingCard file={exchangeFile} fields={EXCHANGE_FIELDS} mapping={exchangeMapping} confidence={autoDetectMapping(EXCHANGE_FIELDS.map((f) => f.name), exchangeFile.columns).confidence} onChange={(field, value) => { onExchangeMappingChange({ ...exchangeMapping, [field]: value }); }} />
      </div>
      {glFile && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">GL Data Mapping</h3>
          <MappingCard file={glFile} fields={GL_FIELDS} mapping={glMapping} confidence={autoDetectMapping(GL_FIELDS.map((f) => f.name), glFile.columns).confidence} onChange={(field, value) => { onGlMappingChange({ ...glMapping, [field]: value }); }} />
        </div>
      )}
      <div className="bg-gray-50 rounded-xl p-4 mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Save Mapping Template</h4>
        <div className="flex gap-2">
          <input type="text" placeholder="Template name..." value={saveName} onChange={(e) => setSaveName(e.target.value)} className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={handleSave} disabled={!saveName.trim()} className="px-4 py-2 bg-gray-700 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300">Save</button>
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back</button>
        <button onClick={onNext} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-md hover:shadow-lg transition-colors">Continue to Review</button>
      </div>
    </div>
  );
}
