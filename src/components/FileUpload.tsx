"use client";

import React, { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import type { FileData, LoadingState } from "../types";

function parseFile(file: File): Promise<FileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
        if (json.length === 0) { reject(new Error("File is empty or has no data rows. Please check the file and try again.")); return; }
        const columns = Object.keys(json[0] as Record<string, unknown>);
        if (columns.length === 0) { reject(new Error("No columns detected. Please make sure the first row contains headers.")); return; }
        resolve({ name: file.name, data: json as Record<string, unknown>[], columns, rowCount: json.length });
      } catch (err) { reject(new Error("Failed to parse file. Please make sure it is a valid Excel (.xlsx/.xls) or CSV file. Error: " + String(err))); }
    };
    reader.onerror = () => reject(new Error("Failed to read file. Please try again."));
    reader.readAsArrayBuffer(file);
  });
}

function DropZone({ label, description, hint, icon, accept, multiple, files, onDrop, onRemove, loading }: {
  label: string; description: string; hint: string; icon: string; accept: string; multiple?: boolean;
  files: FileData[]; onDrop: (files: File[]) => void; onRemove: (name: string) => void; loading: LoadingState;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); setError(null);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) { setError("No files detected. Please try again."); return; }
    for (const f of droppedFiles) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(ext || "")) { setError("Invalid file type: " + f.name + ". Please upload .xlsx, .xls, or .csv files only."); return; }
      if (f.size > 100 * 1024 * 1024) { setError("File too large: " + f.name + " (" + Math.round(f.size / 1024 / 1024) + "MB). Maximum size is 100MB."); return; }
    }
    onDrop(droppedFiles);
  }, [onDrop]);
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files) { onDrop(Array.from(e.target.files)); }
  }, [onDrop]);
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-semibold text-gray-800">{label}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className={"relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer " + (dragOver ? "border-blue-500 bg-blue-50 scale-[1.01]" : files.length > 0 ? "border-green-300 bg-green-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
        onClick={() => document.getElementById("input-" + label)?.click()}>
        <input id={"input-" + label} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleInput} />
        {loading.isLoading ? (
          <div className="py-4">
            <div className="w-12 h-12 mx-auto mb-3 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-blue-700 font-medium">{loading.stage}</p>
            <p className="text-xs text-blue-500 mt-1">{loading.detail}</p>
            <div className="w-64 mx-auto mt-3 bg-blue-100 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: loading.progress + "%" }}></div>
            </div>
            <p className="text-xs text-blue-400 mt-1">{loading.progress}%</p>
          </div>
        ) : files.length > 0 ? (
          <div className="py-2">
            <div className="text-green-600 text-3xl mb-2">&#10003;</div>
            <p className="text-green-700 font-medium">{files.length} file{files.length > 1 ? "s" : ""} loaded successfully</p>
          </div>
        ) : (
          <div className="py-4">
            <div className="text-gray-400 text-3xl mb-2">&#8682;</div>
            <p className="text-gray-600 font-medium">Drag & drop file{multiple ? "s" : ""} here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse</p>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1 italic">{hint}</p>
      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700 font-medium">Error</p>
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-green-500 text-lg">&#9679;</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{f.name}</p>
                  <p className="text-xs text-gray-500">{f.rowCount.toLocaleString()} rows | {f.columns.length} columns</p>
                  <p className="text-xs text-gray-400">Columns: {f.columns.slice(0, 5).join(", ")}{f.columns.length > 5 ? " +" + (f.columns.length - 5) + " more" : ""}</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onRemove(f.name); }} className="text-red-400 hover:text-red-600 text-sm font-medium px-2 py-1 hover:bg-red-50 rounded">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FileUploadProps {
  feeFiles: FileData[];
  exchangeFile: FileData | null;
  glFile: FileData | null;
  onFeeFilesChange: (files: FileData[]) => void;
  onExchangeFileChange: (file: FileData | null) => void;
  onGlFileChange: (file: FileData | null) => void;
  onNext: () => void;
}

export default function FileUpload({ feeFiles, exchangeFile, glFile, onFeeFilesChange, onExchangeFileChange, onGlFileChange, onNext }: FileUploadProps) {
  const [feeLoading, setFeeLoading] = useState<LoadingState>({ isLoading: false, stage: "", progress: 0, detail: "" });
  const [exLoading, setExLoading] = useState<LoadingState>({ isLoading: false, stage: "", progress: 0, detail: "" });
  const [glLoading, setGlLoading] = useState<LoadingState>({ isLoading: false, stage: "", progress: 0, detail: "" });

  const handleFeeFiles = async (files: File[]) => {
    setFeeLoading({ isLoading: true, stage: "Reading files...", progress: 10, detail: "Parsing Excel data" });
    try {
      const results: FileData[] = [...feeFiles];
      for (let i = 0; i < files.length; i++) {
        setFeeLoading({ isLoading: true, stage: "Processing " + files[i].name + "...", progress: 10 + Math.round((i / files.length) * 80), detail: "File " + (i + 1) + " of " + files.length });
        const parsed = await parseFile(files[i]);
        const existing = results.findIndex((f) => f.name === parsed.name);
        if (existing >= 0) { results[existing] = parsed; } else { results.push(parsed); }
      }
      setFeeLoading({ isLoading: true, stage: "Validating...", progress: 95, detail: "Checking data integrity" });
      await new Promise((r) => setTimeout(r, 300));
      onFeeFilesChange(results);
      setFeeLoading({ isLoading: false, stage: "", progress: 100, detail: "" });
    } catch (err) {
      setFeeLoading({ isLoading: false, stage: "", progress: 0, detail: "" });
      alert("Error loading fee file: " + String(err instanceof Error ? err.message : err));
    }
  };

  const handleExchangeFile = async (files: File[]) => {
    setExLoading({ isLoading: true, stage: "Reading exchange rate file...", progress: 30, detail: "Parsing data" });
    try {
      const parsed = await parseFile(files[0]);
      setExLoading({ isLoading: true, stage: "Validating rates...", progress: 80, detail: parsed.rowCount + " rates found" });
      await new Promise((r) => setTimeout(r, 300));
      onExchangeFileChange(parsed);
      setExLoading({ isLoading: false, stage: "", progress: 100, detail: "" });
    } catch (err) {
      setExLoading({ isLoading: false, stage: "", progress: 0, detail: "" });
      alert("Error loading exchange rate file: " + String(err instanceof Error ? err.message : err));
    }
  };

  const handleGlFile = async (files: File[]) => {
    setGlLoading({ isLoading: true, stage: "Reading GL file...", progress: 30, detail: "Parsing data" });
    try {
      const parsed = await parseFile(files[0]);
      setGlLoading({ isLoading: true, stage: "Validating GL data...", progress: 80, detail: parsed.rowCount + " entries found" });
      await new Promise((r) => setTimeout(r, 300));
      onGlFileChange(parsed);
      setGlLoading({ isLoading: false, stage: "", progress: 100, detail: "" });
    } catch (err) {
      setGlLoading({ isLoading: false, stage: "", progress: 0, detail: "" });
      alert("Error loading GL file: " + String(err instanceof Error ? err.message : err));
    }
  };

  const canProceed = feeFiles.length > 0 && exchangeFile !== null;

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Upload Your Files</h2>
        <p className="text-gray-500 mt-1">Upload your fee transaction files, exchange rates, and optionally GL data for comparison</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
        <h3 className="font-semibold text-blue-800 mb-2">How this works:</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span><p className="text-blue-700">Upload your <strong>fee transaction files</strong> containing fee codes, amounts, currencies, and dates</p></div>
          <div className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span><p className="text-blue-700">Upload <strong>exchange rates</strong> file with daily rates per currency (e.g. from Business Central)</p></div>
          <div className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span><p className="text-blue-700">Map columns to system fields - we auto-detect when possible</p></div>
          <div className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">4</span><p className="text-blue-700">Get results: amounts converted to USD, grouped by fee code, compared to GL</p></div>
        </div>
      </div>
      <DropZone label="Fee Transaction Files" description="Upload one or more files containing fee transactions. Required fields: Fee Code, Amount, Currency, Date." hint="Supports .xlsx, .xls, .csv | Multiple files allowed | Max 100MB per file" icon="&#128206;" accept=".xlsx,.xls,.csv" multiple={true} files={feeFiles} onDrop={handleFeeFiles} onRemove={(name) => onFeeFilesChange(feeFiles.filter((f) => f.name !== name))} loading={feeLoading} />
      <DropZone label="Exchange Rate File" description="Daily exchange rates per currency to USD. Expected columns: Date, Currency Code, Exchange Rate." hint="Should contain daily rates for all currencies in your fee files | Supports .xlsx, .xls, .csv" icon="&#128177;" accept=".xlsx,.xls,.csv" files={exchangeFile ? [exchangeFile] : []} onDrop={handleExchangeFile} onRemove={() => onExchangeFileChange(null)} loading={exLoading} />
      <DropZone label="GL Data (Optional)" description="General Ledger data for comparison. The tool will compare calculated USD amounts with GL amounts per fee code." hint="Optional - upload only if you want to compare results against the General Ledger" icon="&#128209;" accept=".xlsx,.xls,.csv" files={glFile ? [glFile] : []} onDrop={handleGlFile} onRemove={() => onGlFileChange(null)} loading={glLoading} />
      {!canProceed && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center mb-6">
          <p className="text-amber-800 text-sm font-medium">
            {feeFiles.length === 0 && !exchangeFile ? "Please upload at least one fee file and an exchange rate file to continue" :
             feeFiles.length === 0 ? "Please upload at least one fee transaction file" :
             "Please upload an exchange rate file"}
          </p>
        </div>
      )}
      <div className="flex justify-end mt-6">
        <button onClick={onNext} disabled={!canProceed} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all text-lg">Continue to Column Mapping &rarr;</button>
      </div>
    </div>
  );
}
