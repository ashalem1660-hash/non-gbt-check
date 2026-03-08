"use client";

import React, { useCallback } from "react";
import type { FileData } from "../types";
import * as XLSX from "xlsx";

interface FileUploadProps {
  feeFiles: FileData[];
  exchangeFile: FileData | null;
  glFile: FileData | null;
  onFeeFilesChange: (files: FileData[]) => void;
  onExchangeFileChange: (file: FileData | null) => void;
  onGlFileChange: (file: FileData | null) => void;
  onNext: () => void;
}

function parseFile(file: File): Promise<FileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
        const columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
        resolve({ name: file.name, data: jsonData, columns, rowCount: jsonData.length });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function DropZone({ label, description, files, multiple, onFiles, onRemove }: {
  label: string; description: string; files: FileData[]; multiple: boolean;
  onFiles: (files: FileData[]) => void; onRemove: (name: string) => void;
}) {
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv")
    );
    const parsed = await Promise.all(droppedFiles.map(parseFile));
    onFiles(multiple ? [...files, ...parsed] : parsed);
  }, [files, multiple, onFiles]);

  const handleSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const parsed = await Promise.all(selected.map(parseFile));
    onFiles(multiple ? [...files, ...parsed] : parsed);
    e.target.value = "";
  }, [files, multiple, onFiles]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold text-gray-800">{label}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
        onClick={() => document.getElementById("input-" + label)?.click()}
      >
        <p className="text-sm text-gray-500">Drag and drop or <span className="text-blue-600 font-medium">browse</span></p>
        <p className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls) or CSV</p>
        <input id={"input-" + label} type="file" accept=".xlsx,.xls,.csv" multiple={multiple} onChange={handleSelect} className="hidden" />
      </div>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-green-800">{f.name}</span>
                <span className="text-xs text-green-600">({f.rowCount.toLocaleString()} rows)</span>
              </div>
              <button onClick={() => onRemove(f.name)} className="text-gray-400 hover:text-red-500 text-lg">x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileUpload({ feeFiles, exchangeFile, glFile, onFeeFilesChange, onExchangeFileChange, onGlFileChange, onNext }: FileUploadProps) {
  const canProceed = feeFiles.length > 0 && exchangeFile !== null;
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Upload Your Files</h2>
        <p className="text-gray-500 mt-1">Upload fee transaction files, exchange rates, and optionally GL data</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DropZone label="Fee Files" description="Upload one or more fee transaction files" files={feeFiles} multiple={true} onFiles={onFeeFilesChange} onRemove={(name) => onFeeFilesChange(feeFiles.filter((f) => f.name !== name))} />
        <DropZone label="Exchange Rates" description="Upload exchange rate file for currency conversion" files={exchangeFile ? [exchangeFile] : []} multiple={false} onFiles={(files) => onExchangeFileChange(files[0] || null)} onRemove={() => onExchangeFileChange(null)} />
        <DropZone label="GL Data (Optional)" description="Upload ledger data for comparison" files={glFile ? [glFile] : []} multiple={false} onFiles={(files) => onGlFileChange(files[0] || null)} onRemove={() => onGlFileChange(null)} />
      </div>
      {!canProceed && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center mb-6">
          <p className="text-amber-700 text-sm">Please upload at least one fee file and an exchange rate file to continue</p>
        </div>
      )}
      <div className="flex justify-center">
        <button onClick={onNext} disabled={!canProceed} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg">
          Continue to Column Mapping
        </button>
      </div>
    </div>
  );
}
