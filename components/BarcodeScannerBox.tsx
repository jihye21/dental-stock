"use client";

import React, { useState, useRef } from "react";
import { 
    Barcode, 
    Camera,
    Building2,
    Search,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";

import {
    Clinic,
    I18N,
    Language,
    MaterialItem,
    TransactionMode,
} from "@/types/inventory";

interface BarcodeScannerBoxProps {
    lang: Language;
    clinics: Clinic[];
    inventory: Record<string, MaterialItem>;
    onProcessScan: (code: string, mode: TransactionMode, clinicId: string) => void;
}

export default function BarcodeScannerBox({
    lang, 
    clinics, 
    inventory,
    onProcessScan,
}: BarcodeScannerBoxProps) {
    const t = I18N[lang];
    const [mode, setMode] = useState<TransactionMode>("OUT");
  const [selectedClinic, setSelectedClinic] = useState<string>(clinics[0]?.id || "");
  const [clinicSearch, setClinicSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectClinic = (clinicId: string) => {
    setSelectedClinic(clinicId);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    onProcessScan(barcodeInput.trim().toUpperCase(), mode, selectedClinic);
    setBarcodeInput("");
    inputRef.current?.focus();
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        {/* 입/출고 모드 토글 */}
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("OUT");
              inputRef.current?.focus();
            }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
              mode === "OUT"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            {t.modeOut}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("IN");
              inputRef.current?.focus();
            }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
              mode === "IN"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowDownRight className="h-4 w-4" />
            {t.modeIn}
          </button>
        </div>

        {/* 개발 테스트용 샘플 바코드 버튼 */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>샘플 코드:</span>
          {Object.keys(inventory).map((sku) => (
            <button
              key={sku}
              type="button"
              onClick={() => {
                setBarcodeInput(sku);
                inputRef.current?.focus();
              }}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono hover:bg-slate-100"
            >
              {sku}
            </button>
          ))}
        </div>
      </div>

      {/* 출고 모드일 때만 최근 빈도순 거래처 노출 */}
      {mode === "OUT" && (
        <div className="mb-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              {t.quickClinicsTitle}
            </label>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={clinicSearch}
                onChange={(e) => setClinicSearch(e.target.value)}
                placeholder={t.searchClinicPlaceholder}
                className="w-full rounded-md border border-slate-200 py-1 pl-8 pr-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {clinics
              .filter((c) => c.name.includes(clinicSearch))
              .map((clinic) => {
                const isSelected = selectedClinic === clinic.id;
                return (
                  <button
                    key={clinic.id}
                    type="button"
                    onClick={() => handleSelectClinic(clinic.id)}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${
                        isSelected ? "text-blue-700" : "text-slate-800"
                      }`}
                    >
                      {clinic.name}
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-500">
                      주간 출고 {clinic.count}건
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* 바코드 스캐너 입력 폼 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Barcode className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder={t.barcodePlaceholder}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 font-mono text-base font-medium focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsCameraOpen(!isCameraOpen)}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Camera className="h-4 w-4 text-slate-600" />
          {t.cameraScanBtn}
        </button>

        <button
          type="submit"
          className={`rounded-lg px-6 py-3 text-sm font-bold text-white shadow-sm transition ${
            mode === "OUT"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {t.submitBtn}
        </button>
      </form>

      {isCameraOpen && (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-100 p-6 text-center">
          <Camera className="mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">
            html5-qrcode 모바일 웹 카메라 스캐너 영역
          </p>
          <p className="text-xs text-slate-500">
            카메라 권한 허용 후 바코드를 비추면 자동으로 제출됩니다.
          </p>
        </div>
      )}
    </section>
  );
}