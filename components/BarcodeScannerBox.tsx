"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Barcode,
  Camera,
  Building2,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import CameraScanner from "@/components/CameraScanner";
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
  selectedClinicId: string;
  onSelectClinic: (clinicId: string) => void;
  onOpenClinicModal: (prefillName?: string) => void;
  inventory: Record<string, MaterialItem>;
  onProcessScan: (code: string, mode: TransactionMode, clinicId: string) => void;
}

export default function BarcodeScannerBox({
  lang,
  clinics,
  selectedClinicId,
  onSelectClinic,
  onOpenClinicModal,
  inventory,
  onProcessScan,
}: BarcodeScannerBoxProps) {
  const t = I18N[lang];
  const [mode, setMode] = useState<TransactionMode>("OUT");
  const [clinicSearch, setClinicSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectClinic = (clinicId: string) => {
    onSelectClinic(clinicId);
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    if (selectedClinicId && window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  }, [selectedClinicId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    onProcessScan(barcodeInput.trim().toUpperCase(), mode, selectedClinicId);
    setBarcodeInput("");
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  };

  const handleCameraScanSuccess = useCallback(
    (decodedCode: string) => {
      onProcessScan(decodedCode, mode, selectedClinicId);
    },
    [mode, selectedClinicId, onProcessScan]
  );

  const filteredClinics = clinics.filter((c) =>
    c.name.toLowerCase().includes(clinicSearch.toLowerCase())
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
      {/* 상단 입/출고 토글 */}
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid w-full grid-cols-2 rounded-lg bg-slate-100 p-1 sm:inline-flex sm:w-auto">
          <button
            type="button"
            onClick={() => setMode("OUT")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 ${
              mode === "OUT"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>{t.modeOut}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("IN")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 ${
              mode === "IN"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowDownRight className="h-4 w-4" />
            <span>{t.modeIn}</span>
          </button>
        </div>

        {/* 빠른 샘플 코드 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-slate-500 sm:pb-0">
          <span className="shrink-0 font-medium">빠른코드:</span>
          {Object.keys(inventory)
            .slice(0, 4)
            .map((sku) => (
              <button
                key={sku}
                type="button"
                onClick={() => setBarcodeInput(sku)}
                className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono active:bg-slate-200 hover:bg-slate-100"
              >
                {sku}
              </button>
            ))}
        </div>
      </div>

      {/* 출고 모드: 거래처 빠른 선택 */}
      {mode === "OUT" && (
        <div className="mb-4 space-y-2.5 sm:mb-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span className="truncate">{t.quickClinicsTitle}</span>
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-44">
                <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={clinicSearch}
                  onChange={(e) => setClinicSearch(e.target.value)}
                  placeholder={t.searchClinicPlaceholder}
                  className="h-8 w-full rounded-md border border-slate-200 pr-2 pl-8 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => onOpenClinicModal(clinicSearch.trim())}
                className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 transition active:scale-95 hover:bg-blue-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === "ko" ? "신규 치과" : "New Clinic"}</span>
              </button>
            </div>
          </div>

          {filteredClinics.length === 0 ? (
            <div className="flex flex-col items-start justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center">
              <span>
                {clinicSearch
                  ? `'${clinicSearch}' 검색 결과가 없습니다.`
                  : "등록된 거래처가 없습니다."}
              </span>
              <button
                type="button"
                onClick={() => onOpenClinicModal(clinicSearch.trim())}
                className="font-bold text-blue-600 hover:underline"
              >
                + &apos;{clinicSearch || "새 거래처"}&apos; 바로 등록하기
              </button>
            </div>
          ) : (
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-6">
              {filteredClinics.map((clinic) => {
                const isSelected = selectedClinicId === clinic.id;
                return (
                  <button
                    key={clinic.id}
                    type="button"
                    onClick={() => handleSelectClinic(clinic.id)}
                    className={`flex min-w-[132px] shrink-0 snap-start flex-col items-start rounded-lg border p-3 text-left transition active:scale-95 sm:min-w-0 ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/80 ring-1 ring-blue-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-full truncate text-sm font-bold ${
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
          )}
        </div>
      )}

      {/* 바코드 입력 폼 */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2.5 sm:flex-row sm:gap-3"
      >
        <div className="relative flex-1">
          <Barcode className="absolute top-3.5 left-3.5 h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder={t.barcodePlaceholder}
            className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 pr-4 pl-11 font-mono text-base font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <button
            type="button"
            onClick={() => setIsCameraOpen(!isCameraOpen)}
            className={`flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition active:scale-95 ${
              isCameraOpen
                ? "border-slate-800 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Camera className="h-4 w-4 shrink-0" />
            <span>{isCameraOpen ? "카메라 끄기" : t.cameraScanBtn}</span>
          </button>

          <button
            type="submit"
            className={`h-12 rounded-lg px-6 text-sm font-bold text-white shadow-xs transition active:scale-95 ${
              mode === "OUT"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {t.submitBtn}
          </button>
        </div>
      </form>

      {/* html5-qrcode 카메라 스캐너 */}
      {isCameraOpen && (
        <CameraScanner
          onScanSuccess={handleCameraScanSuccess}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </section>
  );
}
