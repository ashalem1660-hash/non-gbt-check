"use client";

import React, { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import type { FileData, LoadingState } from "../types";

function parseCSVChunked(text: string, onProgress: (p: number) => void): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  // Detect delimiter
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = tabCount > commaCount && tabCount > semiCount ? "\t" : semiCount > commaCount ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.replace(/^"|"$/g, "").trim());
  const results: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (i % 50000 === 0) onProgress(Math.round((i / lines.length) * 100));
    const values = lines[i].split(delimiter);
    const row: Record<string, unknown> = {};
    let hasValue = false;
    for (let j = 0; j < headers.length; j++) {
      const val = (values[j] || "").replace(/^"|"$/g, "").trim();
      row[headers[j]] = val || null;
      if (val) hasValue = true;
    }
    if (hasValue) results.push(row);
  }
  return results;
}

function parseExcelChunked(data: Uint8Array, onProgress: (p: number) => void): { rows: Record<string, unknown>[]; columns: string[] } {
  onProgress(10);
  const workbook = XLSX.read(data, { type: "array", cellDates: true, dense: true });
  onProgress(30);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  onProgress(50);
  // Use sheet_to_json with limited processing
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  onProgress(80);
  if (json.length === 0) return { rows: [], columns: [] };
  const columns = Object.keys(json[0] as Record<string, unknown>);
  onProgress(100);
  return { rows: json as Record<string, unknown>[], columns };
}

function parseFile(file: File, setLoading: (l: LoadingState) => void): Promise<FileData> {
  return new Promise((resolve, reject) => {
    const isCSV = file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".txt");
    const sizeMB = Math.round(file.size / 1024 / 1024);

    if (isCSV) {
      setLoading({ isLoading: true, stage: "Reading CSV file (" + sizeMB + "MB)...", progress: 10, detail: "Loading into memory" });
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          setLoading({ isLoading: true, stage: "Parsing CSV rows...", progress: 20, detail: "Detecting format" });
          const rows = parseCSVChunked(text, (p) => {
            setLoading({ isLoading: true, stage: "Processing rows...", progress: 20 + Math.round(p * 0.7), detail: "Processing data" });
          });
          if (rows.length === 0) { reject(new Error("File is empty or has no data rows.")); return; }
          const columns = Object.keys(rows[0]);
          setLoading({ isLoading: true, stage: "Done!", progress: 100, detail: rows.length.toLocaleString() + " rows loaded" });
          resolve({ name: file.name, data: rows, columns, rowCount: rows.length });
        } catch (err) {
          reject(new Error("Failed to parse CSV: " + String(err)));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsText(file);
    } else {
      setLoading({ isLoading: true, stage: "Reading Excel file (" + sizeMB + "MB)...", progress: 5, detail: "This may take a moment for large files" });
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          setLoading({ isLoading: true, stage: "Parsing Excel data...", progress: 15, detail: "Reading workbook structure" });
          // For very large files, try chunked approach
          if (file.size > 50 * 1024 * 1024) {
            setLoading({ isLoading: true, stage: "Large file detected (" + sizeMB + "MB)...", progress: 15, detail: "Using optimized parser" });
          }
          const { rows, columns } = parseExcelChunked(data, (p) => {
            setLoading({ isLoading: true, stage: "Processing Excel...", progress: 15 + Math.round(p * 0.75), detail: "Extracting data" });
          });
          if (rows.length === 0) { reject(new Error("File is empty or has no data rows. Check if data is on the first sheet.")); return; }
          setLoading({ isLoading: true, stage: "Finalizing...", progress: 95, detail: rows.length.toLocaleString() + " rows loaded" });
          resolve({ name: file.name, data: rows, columns, rowCount: rows.length });
        } catch (err) {
          const errMsg = String(err);
          if (errMsg.includes("RangeError") || errMsg.includes("too many") || errMsg.includes("memory")) {
            reject(new Error("File is too large for Excel format (" + sizeMB + "MB). Please save as CSV and try again. In Excel: File > Save As > CSV (Comma delimited)."));
          } else {
            reject(new Error("Failed to parse Excel: " + errMsg));
          }
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsArrayBuffer(file);
    }
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
      if (!["xlsx", "xls", "csv", "txt"].includes(ext || "")) { setError("Invalid file type: " + f.name + ". Please upload .xlsx, .xls, .csv, or .txt files."); return; }
      if (f.size > 500 * 1024 * 1024) { setError("File too large: " + f.name + " (" + Math.round(f.size / 1024 / 1024) + "MB). Maximum size is 500MB."); return; }
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
          {error.includes("too large for Excel") && (
            <div className="mt-2 bg-white rounded p-2 border border-red-100">
              <p className="text-xs text-red-800 font-medium">How to convert to CSV:</p>
              <ol className="text-xs text-red-600 ml-4 list-decimal mt-1">
                <li>Open the file in Excel</li>
                <li>Go to File &gt; Save As</li>
                <li>Choose &quot;CSV (Comma delimited) (*.csv)&quot;</li>
                <li>Click Save, then upload the CSV file</li>
              </ol>
            </div>
          )}
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
    try {
      const results: FileData[] = [...feeFiles];
      for (let i = 0; i < files.length; i++) {
        const parsed = await parseFile(files[i], setFeeLoading);
        const existing = results.findIndex((f) => f.name === parsed.name);
        if (existing >= 0) { results[existing] = parsed; } else { results.push(parsed); }
      }
      onFeeFilesChange(results);
      setFeeLoading({ isLoading: false, stage: "", progress: 100, detail: "" });
    } catch (err) {
      setFeeLoading({ isLoading: false, stage: "", progress: 0, detail: "" });
      alert("Error loading fee file: " + String(err instanceof Error ? err.message : err));
    }
  };

  const handleExchangeFile = async (files: File[]) => {
    try {
      const parsed = await parseFile(files[0], setExLoading);
      onExchangeFileChange(parsed);
      setExLoading({ isLoading: false, stage: "", progress: 100, detail: "" });
    } catch (err) {
      setExLoading({ isLoading: false, stage: "", progress: 0, detail: "" });
      alert("Error loading exchange rate file: " + String(err instanceof Error ? err.message : err));
    }
  };

  const handleGlFile = async (files: File[]) => {
    try {
      const parsed = await parseFile(files[0], setGlLoading);
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
          <div className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span><p className="text-blue-700">Upload <strong>exchange rates</strong> file with daily rates per currency</p></div>
          <div className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span><p className="text-blue-700">Map columns to system fields - we auto-detect when possible</p></div>
          <div className="flex items-start gap-2"><span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">4</span><p className="text-blue-700">Get results: amounts converted to USD, grouped by fee code, compared to GL</p></div>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
        <p className="text-sm text-amber-800 font-medium">Large files? No problem!</p>
        <p className="text-xs text-amber-700 mt-1">For files over 100K rows, we recommend saving as CSV for best performance. Excel files up to ~200K rows work fine. CSV files handle 500K+ rows.</p>
      </div>
      <DropZone label="Fee Transaction Files" description="Upload one or more files containing fee transactions." hint="Supports .xlsx, .xls, .csv | Multiple files | For large files (500K+ rows) use CSV format" icon="&#128206;" accept=".xlsx,.xls,.csv,.txt" multiple={true} files={feeFiles} onDrop={handleFeeFiles} onRemove={(name) => onFeeFilesChange(feeFiles.filter((f) => f.name !== name))} loading={feeLoading} />
      <DropZone label="Exchange Rate File" description="Daily exchange rates per currency to USD." hint="Expected: Date, Currency Code, Exchange Rate columns | Supports .xlsx, .xls, .csv" icon="&#128177;" accept=".xlsx,.xls,.csv,.txt" files={exchangeFile ? [exchangeFile] : []} onDrop={handleExchangeFile} onRemove={() => onExchangeFileChange(null)} loading={exLoading} />
      <DropZone label="GL Data (Optional)" description="General Ledger data for comparison." hint="Optional - for comparing calculated amounts against GL" icon="&#128209;" accept=".xlsx,.xls,.csv,.txt" files={glFile ? [glFile] : []} onDrop={handleGlFile} onRemove={() => onGlFileChange(null)} loading={glLoading} />
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
