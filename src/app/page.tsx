"use client";

import React, { useState } from "react";
import type { FileData, ColumnMapping, ProcessingResults, AppStep } from "../types";
import FileUpload from "../components/FileUpload";
import ColumnMappingComponent from "../components/ColumnMapping";
import Review from "../components/Review";
import Results from "../components/Results";
import { processData } from "../lib/processing";

const STEPS = [
  { num: 1, label: "Upload Files", icon: "1" },
  { num: 2, label: "Map Columns", icon: "2" },
  { num: 3, label: "Review & Validate", icon: "3" },
  { num: 4, label: "Results", icon: "4" },
];

function StepIndicator({ current }: { current: AppStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.num}>
          <div className="flex items-center gap-2">
            <div className={"w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all " + (step.num < current ? "bg-green-500 text-white" : step.num === current ? "bg-blue-600 text-white ring-4 ring-blue-200" : "bg-gray-200 text-gray-500")}>
              {step.num < current ? "\u2713" : step.icon}
            </div>
            <span className={"text-sm font-medium hidden md:inline " + (step.num === current ? "text-blue-700" : step.num < current ? "text-green-600" : "text-gray-400")}>{step.label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={"w-12 h-0.5 " + (step.num < current ? "bg-green-400" : "bg-gray-200")}></div>}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<AppStep>(1);
  const [feeFiles, setFeeFiles] = useState<FileData[]>([]);
  const [exchangeFile, setExchangeFile] = useState<FileData | null>(null);
  const [glFile, setGlFile] = useState<FileData | null>(null);
  const [feeMappings, setFeeMappings] = useState<Record<string, ColumnMapping>>({});
  const [exchangeMapping, setExchangeMapping] = useState<ColumnMapping>({});
  const [glMapping, setGlMapping] = useState<ColumnMapping>({});
  const [results, setResults] = useState<ProcessingResults | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  const handleProcess = () => {
    try {
      setProcessError(null);
      if (!exchangeFile) { setProcessError("Exchange rate file is missing. Please go back and upload it."); return; }
      const res = processData(feeFiles, feeMappings, exchangeFile, exchangeMapping, glFile || undefined, glFile ? glMapping : undefined);
      if (res.totalRecords === 0 && res.errors && res.errors.length > 0) {
        setProcessError("No records could be processed. " + res.errors.length + " errors found. Most common: " + res.errors[0].message + ". Please go back and check your column mappings.");
        return;
      }
      setResults(res);
      setStep(4);
    } catch (err) {
      setProcessError("Processing failed: " + String(err instanceof Error ? err.message : err) + ". Please check your files and mappings.");
    }
  };

  const handleReset = () => {
    setStep(1);
    setFeeFiles([]);
    setExchangeFile(null);
    setGlFile(null);
    setFeeMappings({});
    setExchangeMapping({});
    setGlMapping({});
    setResults(null);
    setProcessError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Non-GBT Completeness Check</h1>
          <p className="text-gray-500 mt-1">Fee transaction analysis and GL reconciliation tool</p>
        </div>
        <StepIndicator current={step} />
        {processError && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6 text-center">
            <h3 className="font-semibold text-red-800 mb-1">Processing Error</h3>
            <p className="text-sm text-red-700">{processError}</p>
            <button onClick={() => { setProcessError(null); setStep(3); }} className="mt-2 text-sm text-red-700 font-semibold underline hover:text-red-900">Go back and fix</button>
          </div>
        )}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg p-6 md:p-8">
          {step === 1 && (
            <FileUpload feeFiles={feeFiles} exchangeFile={exchangeFile} glFile={glFile} onFeeFilesChange={setFeeFiles} onExchangeFileChange={setExchangeFile} onGlFileChange={setGlFile} onNext={() => setStep(2)} />
          )}
          {step === 2 && exchangeFile && (
            <ColumnMappingComponent feeFiles={feeFiles} exchangeFile={exchangeFile} glFile={glFile} feeMappings={feeMappings} exchangeMapping={exchangeMapping} glMapping={glMapping} onFeeMappingsChange={setFeeMappings} onExchangeMappingChange={setExchangeMapping} onGlMappingChange={setGlMapping} onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && exchangeFile && (
            <Review feeFiles={feeFiles} exchangeFile={exchangeFile} glFile={glFile} feeMappings={feeMappings} exchangeMapping={exchangeMapping} glMapping={glMapping} onProcess={handleProcess} onBack={() => setStep(2)} />
          )}
          {step === 4 && results && (
            <Results results={results} onBack={() => setStep(3)} onReset={handleReset} />
          )}
        </div>
        <div className="text-center mt-6 text-xs text-gray-400">
          <p>Non-GBT Completeness Check Tool | All data is processed locally in your browser | No data is sent to any server</p>
        </div>
      </div>
    </main>
  );
}
