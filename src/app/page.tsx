"use client";

import React, { useState } from "react";
import type { FileData, ColumnMapping, ProcessingResults, AppStep } from "../types";
import FileUpload from "../components/FileUpload";
import ColumnMappingComponent from "../components/ColumnMapping";
import Review from "../components/Review";
import Results from "../components/Results";
import { processData } from "../lib/processing";

const STEPS = [
  { num: 1, label: "Upload" },
  { num: 2, label: "Mapping" },
  { num: 3, label: "Review" },
  { num: 4, label: "Results" },
];

function StepIndicator({ current }: { current: AppStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.num}>
          <div className="flex items-center gap-2">
            <div className={"w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors " + (step.num < current ? "bg-green-500 text-white" : step.num === current ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-gray-200 text-gray-500")}>
              {step.num < current ? "\u2713" : step.num}
            </div>
            <span className={"text-sm font-medium hidden sm:block " + (step.num === current ? "text-blue-700" : step.num < current ? "text-green-600" : "text-gray-400")}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (<div className={"w-12 h-0.5 " + (step.num < current ? "bg-green-400" : "bg-gray-200")} />)}
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

  const handleProcess = () => {
    if (!exchangeFile) return;
    const res = processData(feeFiles, feeMappings, exchangeFile, exchangeMapping, glFile || undefined, glFile ? glMapping : undefined);
    setResults(res);
    setStep(4);
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Non-GBT Completeness Check</h1>
              <p className="text-xs text-gray-500">Audit Fee Verification Tool</p>
            </div>
          </div>
          <span className="text-xs text-gray-400">v1.0</span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <StepIndicator current={step} />
        {step === 1 && (<FileUpload feeFiles={feeFiles} exchangeFile={exchangeFile} glFile={glFile} onFeeFilesChange={setFeeFiles} onExchangeFileChange={setExchangeFile} onGlFileChange={setGlFile} onNext={() => setStep(2)} />)}
        {step === 2 && exchangeFile && (<ColumnMappingComponent feeFiles={feeFiles} exchangeFile={exchangeFile} glFile={glFile} feeMappings={feeMappings} exchangeMapping={exchangeMapping} glMapping={glMapping} onFeeMappingsChange={setFeeMappings} onExchangeMappingChange={setExchangeMapping} onGlMappingChange={setGlMapping} onNext={() => setStep(3)} onBack={() => setStep(1)} />)}
        {step === 3 && exchangeFile && (<Review feeFiles={feeFiles} exchangeFile={exchangeFile} glFile={glFile} feeMappings={feeMappings} exchangeMapping={exchangeMapping} glMapping={glMapping} onProcess={handleProcess} onBack={() => setStep(2)} />)}
        {step === 4 && results && (<Results results={results} onBack={() => setStep(3)} onReset={handleReset} />)}
      </main>
      <footer className="text-center py-6 text-xs text-gray-400">Non-GBT Completeness Check Tool - Internal Audit Use Only</footer>
    </div>
  );
}
