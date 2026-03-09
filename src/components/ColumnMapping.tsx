"use client";

import React, { useEffect, useState } from "react";
import type { FileData, ColumnMapping as ColumnMappingType, SavedMapping } from "../types";
import { autoDetectMapping } from "../lib/fuzzyMatch";
import { detectColumnType } from "../lib/processing";

const FEE_FIELDS = [
  { name: "Fee Code", description: "Fee code identifier", required: true, examples: "3004, 3032" },
  { name: "Fee Amount", description: "Transaction amount", required: true, examples: "150.00, -23.50" },
  { name: "Currency", description: "Currency code", required: true, examples: "USD, EUR, GBP" },
  { name: "Transaction Date", description: "Date of transaction", required: true, examples: "2025-01-15" },
];

const EXCHANGE_FIELDS = [
  { name: "Rate Date", description: "Date of exchange rate", required: true, examples: "2025-01-15" },
  { name: "Currency Code", description: "Currency code", required: true, examples: "USD, EUR" },
  { name: "Exchange Rate", description: "Exchange rate to USD", required: true, examples: "1.0, 0.92" },
];

const GL_FIELDS = [
  { name: "Fee Code", description: "Fee code identifier", required: true, examples: "3004, 3032" },
  { name: "GL Amount (USD)", description: "Ledger amount in USD", required: true, examples: "45230.00" },
];

function getPreview(data: Record<string, unknown>[], column: string): string {
  return data.slice(0, 4).map((row) => String(row[column] ?? "")).filter(Boolean).join(", ");
}

function TypeBadge({ type }: { type: "text" | "numeric" | "date" }) {
  const colors = { text: "bg-gray-100 text-gray-700", numeric: "bg-blue-100 text-blue-700", date: "bg-purple-100 text-purple-700" };
  const icons = { text: "Aa", numeric: "#", date: "D" };
  return <span className={"px-1.5 py-0.5 rounded text-xs font-bold " + colors[type]}>{icons[type]} {type}</span>;
}

function MappingCard({ file, fields, mapping, confidence, columnTypes, typeOverrides, onTypeOverride, onChange }: {
  file: FileData;
  fields: { name: string; description: string; required: boolean; examples: string }[];
  mapping: ColumnMappingType;
  confidence: Record<string, number>;
  columnTypes: Record<string, { type: "text" | "numeric" | "date"; sample: string }>;
  typeOverrides: Record<string, string>;
  onTypeOverride: (col: string, type: string) => void;
  onChange: (field: string, value: string | null) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const mappedCount = fields.filter((f) => mapping[f.name]).length;
  const requiredCount = fields.filter((f) => f.required).length;
  const requiredMapped = fields.filter((f) => f.required && mapping[f.name]).length;
  const allRequiredMapped = requiredMapped === requiredCount;
  return (
    <div className={"bg-white rounded-xl border p-5 shadow-sm " + (allRequiredMapped ? "border-green-200" : "border-amber-300")}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={"w-2.5 h-2.5 rounded-full " + (allRequiredMapped ? "bg-green-500" : "bg-amber-500")}></span>
          <h3 className="font-semibold text-gray-800">{file.name}</h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{file.rowCount.toLocaleString()} rows | {file.columns.length} cols</span>
          <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (allRequiredMapped ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{mappedCount}/{fields.length} mapped</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTypes(!showTypes)} className="text-sm text-purple-600 hover:text-purple-800 font-medium">{showTypes ? "Hide Types" : "Column Types"}</button>
          <button onClick={() => setShowPreview(!showPreview)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">{showPreview ? "Hide Preview" : "Data Preview"}</button>
        </div>
      </div>
      {showTypes && (
        <div className="mb-4 bg-purple-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-purple-800 mb-3">Column Type Detection</h4>
          <p className="text-xs text-purple-600 mb-3">Auto-detected types shown below. You can override if the detection is wrong.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {file.columns.map((col) => {
              const detected = columnTypes[col] || { type: "text", sample: "" };
              const overridden = typeOverrides[col];
              return (
                <div key={col} className="flex items-center gap-2 bg-white rounded-md px-3 py-2 border border-purple-200">
                  <span className="text-sm text-gray-700 font-medium flex-1 truncate">{col}</span>
                  <TypeBadge type={(overridden || detected.type) as "text" | "numeric" | "date"} />
                  <select value={overridden || detected.type} onChange={(e) => onTypeOverride(col, e.target.value)} className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white">
                    <option value="text">Text</option>
                    <option value="numeric">Numeric</option>
                    <option value="date">Date</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {showPreview && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-gray-50">{file.columns.map((col) => {
              const detected = columnTypes[col] || { type: "text" };
              const overridden = typeOverrides[col];
              return (<th key={col} className="border border-gray-200 px-2 py-1 text-left">
                <div className="font-medium text-gray-600">{col}</div>
                <TypeBadge type={(overridden || detected.type) as "text" | "numeric" | "date"} />
              </th>);
            })}</tr></thead>
            <tbody>{file.data.slice(0, 5).map((row, i) => (<tr key={i}>{file.columns.map((col) => (<td key={col} className="border border-gray-200 px-2 py-1 text-gray-700">{String(row[col] ?? "")}</td>))}</tr>))}</tbody>
          </table>
        </div>
      )}
      {!allRequiredMapped && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800 font-medium">Missing required mappings:</p>
          <p className="text-sm text-amber-700">{fields.filter((f) => f.required && !mapping[f.name]).map((f) => f.name).join(", ")}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => {
          const conf = confidence[field.name] || 0;
          const isMapped = mapping[field.name] !== null && mapping[field.name] !== undefined;
          const bgColor = isMapped ? (conf >= 0.8 ? "bg-green-50" : "bg-blue-50") : (field.required ? "bg-red-50" : "bg-gray-50");
          const borderColor = isMapped ? (conf >= 0.8 ? "border-green-300" : "border-blue-300") : (field.required ? "border-red-300" : "border-gray-200");
          const confText = conf >= 0.8 ? "Auto-detected" : conf >= 0.5 ? "Possible match" : "";
          const confColor = conf >= 0.8 ? "text-green-600" : "text-amber-600";
          return (
            <div key={field.name} className={"rounded-lg border p-3 " + bgColor + " " + borderColor}>
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
                {file.columns.map((col) => {
                  const ct = columnTypes[col] || { type: "text" };
                  const override = typeOverrides[col];
                  const displayType = override || ct.type;
                  return (<option key={col} value={col}>[{displayType}] {col}</option>);
                })}
              </select>
              {mapping[field.name] && <p className="text-xs text-gray-500 mt-1 italic">Preview: {getPreview(file.data, mapping[field.name]!)}</p>}
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
  const [typeOverrides, setTypeOverrides] = useState<Record<string, Record<string, string>>>({});
  const [columnTypes, setColumnTypes] = useState<Record<string, Record<string, { type: "text" | "numeric" | "date"; sample: string }>>>({});

  useEffect(() => {
    // Detect column types
    const types: Record<string, Record<string, { type: "text" | "numeric" | "date"; sample: string }>> = {};
    const allFiles = [...feeFiles, exchangeFile, ...(glFile ? [glFile] : [])];
    for (const file of allFiles) {
      types[file.name] = {};
      for (const col of file.columns) {
        const values = file.data.map((row) => row[col]);
        types[file.name][col] = detectColumnType(values);
      }
    }
    setColumnTypes(types);
    // Auto-detect mappings
    const newFee: Record<string, ColumnMappingType> = {};
    for (const file of feeFiles) {
      if (!feeMappings[file.name] || Object.keys(feeMappings[file.name]).length === 0) {
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

  const handleTypeOverride = (fileName: string, col: string, type: string) => {
    setTypeOverrides((prev) => ({ ...prev, [fileName]: { ...(prev[fileName] || {}), [col]: type } }));
  };

  const handleSave = () => {
    if (!saveName.trim()) return;
    const newM: SavedMapping = { id: Date.now().toString(), name: saveName, mapping: feeMappings[feeFiles[0]?.name] || {}, savedAt: new Date().toLocaleString() };
    const updated = [...savedMappings, newM];
    setSavedMappings(updated);
    localStorage.setItem("savedMappings", JSON.stringify(updated));
    setSaveName("");
  };

  const allFeeRequiredMapped = feeFiles.every((file) => {
    const m = feeMappings[file.name] || {};
    return FEE_FIELDS.filter((f) => f.required).every((f) => m[f.name]);
  });
  const allExchangeRequiredMapped = EXCHANGE_FIELDS.filter((f) => f.required).every((f) => exchangeMapping[f.name]);
  const allGlRequiredMapped = !glFile || GL_FIELDS.filter((f) => f.required).every((f) => glMapping[f.name]);
  const canProceed = allFeeRequiredMapped && allExchangeRequiredMapped && allGlRequiredMapped;

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Column Mapping</h2>
        <p className="text-gray-500 mt-1">Map your file columns to system fields. Auto-detected types can be overridden.</p>
        <div className="flex justify-center gap-4 mt-3">
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span><span className="text-xs text-gray-500">All required mapped</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span><span className="text-xs text-gray-500">Missing required</span></div>
        </div>
      </div>
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">Fee Files <span className={"text-xs px-2 py-0.5 rounded-full " + (allFeeRequiredMapped ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{allFeeRequiredMapped ? "Ready" : "Needs attention"}</span></h3>
        <div className="space-y-6">
          {feeFiles.map((file) => {
            const { confidence } = autoDetectMapping(FEE_FIELDS.map((f) => f.name), file.columns);
            return (<MappingCard key={file.name} file={file} fields={FEE_FIELDS} mapping={feeMappings[file.name] || {}} confidence={confidence} columnTypes={columnTypes[file.name] || {}} typeOverrides={typeOverrides[file.name] || {}} onTypeOverride={(col, type) => handleTypeOverride(file.name, col, type)} onChange={(field, value) => { onFeeMappingsChange({ ...feeMappings, [file.name]: { ...feeMappings[file.name], [field]: value } }); }} />);
          })}
        </div>
      </div>
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">Exchange Rates <span className={"text-xs px-2 py-0.5 rounded-full " + (allExchangeRequiredMapped ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{allExchangeRequiredMapped ? "Ready" : "Needs attention"}</span></h3>
        <MappingCard file={exchangeFile} fields={EXCHANGE_FIELDS} mapping={exchangeMapping} confidence={autoDetectMapping(EXCHANGE_FIELDS.map((f) => f.name), exchangeFile.columns).confidence} columnTypes={columnTypes[exchangeFile.name] || {}} typeOverrides={typeOverrides[exchangeFile.name] || {}} onTypeOverride={(col, type) => handleTypeOverride(exchangeFile.name, col, type)} onChange={(field, value) => { onExchangeMappingChange({ ...exchangeMapping, [field]: value }); }} />
      </div>
      {glFile && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">GL Data <span className={"text-xs px-2 py-0.5 rounded-full " + (allGlRequiredMapped ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{allGlRequiredMapped ? "Ready" : "Needs attention"}</span></h3>
          <MappingCard file={glFile} fields={GL_FIELDS} mapping={glMapping} confidence={autoDetectMapping(GL_FIELDS.map((f) => f.name), glFile.columns).confidence} columnTypes={columnTypes[glFile.name] || {}} typeOverrides={typeOverrides[glFile.name] || {}} onTypeOverride={(col, type) => handleTypeOverride(glFile.name, col, type)} onChange={(field, value) => { onGlMappingChange({ ...glMapping, [field]: value }); }} />
        </div>
      )}
      <div className="bg-gray-50 rounded-xl p-4 mb-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Save Mapping Template</h4>
        <div className="flex gap-2">
          <input type="text" placeholder="Template name..." value={saveName} onChange={(e) => setSaveName(e.target.value)} className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={handleSave} disabled={!saveName.trim()} className="px-4 py-2 bg-gray-700 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300">Save</button>
        </div>
      </div>
      {!canProceed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center mb-6">
          <p className="text-red-700 text-sm font-medium">Please map all required fields (*) before continuing</p>
          <p className="text-red-600 text-xs mt-1">Each file must have all required fields mapped to proceed</p>
        </div>
      )}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back</button>
        <button onClick={onNext} disabled={!canProceed} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-colors">Continue to Review</button>
      </div>
    </div>
  );
}
