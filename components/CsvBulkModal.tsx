// components/CsvBulkModal.tsx
"use client";

import React, { useState, useRef } from "react";
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  Building2,
} from "lucide-react";
import { Language } from "@/types/inventory";
import {
  parseMaterialCsv,
  parseClinicCsv,
  downloadSampleMaterialCsv,
  downloadSampleClinicCsv,
  ParsedMaterialRow,
  ParsedClinicRow,
} from "@/lib/csv";

interface CsvBulkModalProps {
  isOpen: boolean;
  lang: Language;
  labId: string;
  onClose: () => void;
  onSuccess: (summaryMessage: string) => void;
}

type BulkTab = "materials" | "clinics";

export default function CsvBulkModal({
  isOpen,
  lang,
  labId,
  onClose,
  onSuccess,
}: CsvBulkModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<BulkTab>("materials");

  const [fileName, setFileName] = useState<string>("");
  const [materialRows, setMaterialRows] = useState<ParsedMaterialRow[]>([]);
  const [clinicRows, setClinicRows] = useState<ParsedClinicRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "upsert">("skip");
  const [isUploading, setIsUploading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetFileState = () => {
    setFileName("");
    setMaterialRows([]);
    setClinicRows([]);
    setParseErrors([]);
    setServerError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTabChange = (tab: BulkTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    resetFileState();
  };

  const handleClose = () => {
    resetFileState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setServerError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || "");
      if (activeTab === "materials") {
        const { validRows, errors } = parseMaterialCsv(text);
        setMaterialRows(validRows);
        setParseErrors(errors);
      } else {
        const { validRows, errors } = parseClinicCsv(text);
        setClinicRows(validRows);
        setParseErrors(errors);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const validCount =
    activeTab === "materials" ? materialRows.length : clinicRows.length;

  const handleSubmit = async () => {
    if (validCount === 0 || isUploading) return;
    setIsUploading(true);
    setServerError(null);

    try {
      if (activeTab === "materials") {
        const res = await fetch("/api/materials/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labId,
            items: materialRows,
            duplicateMode,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "자재 일괄 등록에 실패했습니다.");

        const { created, updated, skipped } = data.summary;
        const msg =
          lang === "ko"
            ? `자재 일괄 등록 완료 (신규 ${created}건, 수정 ${updated}건, 건너뜀 ${skipped}건)`
            : `Materials imported (Created: ${created}, Updated: ${updated}, Skipped: ${skipped})`;

        resetFileState();
        onSuccess(msg);
        onClose();
      } else {
        const res = await fetch("/api/clinics/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labId,
            items: clinicRows,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "거래처 일괄 등록에 실패했습니다.");

        const { created, restored, skipped } = data.summary;
        const msg =
          lang === "ko"
            ? `거래처 일괄 등록 완료 (신규 ${created}곳${restored > 0 ? `, 복구 ${restored}곳` : ""
            }, 중복 건너뜀 ${skipped}곳)`
            : `Clinics imported (Created: ${created}, Skipped: ${skipped})`;

        resetFileState();
        onSuccess(msg);
        onClose();
      }
    } catch (err: any) {
      setServerError(err.message || "서버 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {lang === "ko" ? "엑셀(CSV) 데이터 일괄 등록" : "Bulk Import via CSV"}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === "ko"
                  ? "자재 마스터 또는 치과 거래처 목록을 한 번에 등록합니다."
                  : "Upload a CSV file to bulk register materials or clinics."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 대상 선택 탭 */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 px-5 pt-2">
          <button
            type="button"
            onClick={() => handleTabChange("materials")}
            className={`flex items-center justify-center gap-2 border-b-2 py-2.5 text-xs font-bold transition ${activeTab === "materials"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            <Package className="h-4 w-4" />
            {lang === "ko" ? "자재(바코드) 일괄 등록" : "Materials"}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("clinics")}
            className={`flex items-center justify-center gap-2 border-b-2 py-2.5 text-xs font-bold transition ${activeTab === "clinics"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            <Building2 className="h-4 w-4" />
            {lang === "ko" ? "거래처(치과) 일괄 등록" : "Clinics"}
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* 1단계: 샘플 양식 다운로드 */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center">
            <div className="text-xs text-slate-700">
              <p className="font-semibold text-blue-900">
                {activeTab === "materials"
                  ? lang === "ko"
                    ? "1. 자재 등록용 표준 CSV 양식 다운로드"
                    : "1. Download Material Sample CSV"
                  : lang === "ko"
                    ? "1. 거래처 등록용 표준 CSV 양식 다운로드"
                    : "1. Download Clinic Sample CSV"}
              </p>
              <p className="mt-0.5 text-slate-600">
                {lang === "ko"
                  ? "엑셀에서 작성 후 'CSV UTF-8(쉼표로 분리)' 형식으로 저장해 주세요."
                  : "Save your spreadsheet as CSV (Comma delimited, UTF-8)."}
              </p>
            </div>
            <button
              type="button"
              onClick={
                activeTab === "materials"
                  ? downloadSampleMaterialCsv
                  : downloadSampleClinicCsv
              }
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-2xs transition hover:bg-blue-50"
            >
              <Download className="h-3.5 w-3.5" />
              {lang === "ko" ? "샘플 양식 받기" : "Sample CSV"}
            </button>
          </div>

          {/* 2단계: 중복 처리 안내 (자재 탭일 때만 선택 옵션 노출) */}
          {activeTab === "materials" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {lang === "ko"
                  ? "2. 이미 등록된 바코드 처리 방식"
                  : "2. Duplicate Barcode Handling"}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDuplicateMode("skip")}
                  className={`rounded-lg border p-2.5 text-left text-xs transition ${duplicateMode === "skip"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  <div className="font-bold">
                    {lang === "ko" ? "기존 데이터 유지 (건너뛰기)" : "Skip Duplicates"}
                  </div>
                  <div
                    className={`mt-0.5 text-[11px] ${duplicateMode === "skip" ? "text-slate-300" : "text-slate-500"
                      }`}
                  >
                    {lang === "ko" ? "신규 바코드만 추가합니다." : "Only insert new barcodes."}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateMode("upsert")}
                  className={`rounded-lg border p-2.5 text-left text-xs transition ${duplicateMode === "upsert"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  <div className="font-bold">
                    {lang === "ko" ? "최신 정보로 덮어쓰기" : "Overwrite (Upsert)"}
                  </div>
                  <div
                    className={`mt-0.5 text-[11px] ${duplicateMode === "upsert" ? "text-slate-300" : "text-slate-500"
                      }`}
                  >
                    {lang === "ko"
                      ? "품목명·재고·단가를 CSV 기준으로 갱신합니다."
                      : "Update existing items with CSV values."}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
              •{" "}
              {lang === "ko"
                ? "이미 등록된 동일한 치과명은 중복 등록되지 않고 자동으로 건너뜁니다."
                : "Existing clinic names will be skipped automatically."}
            </div>
          )}

          {/* 3단계: 파일 선택 */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {activeTab === "materials"
                ? lang === "ko"
                  ? "3. 자재 CSV 파일 선택"
                  : "3. Select Material CSV File"
                : lang === "ko"
                  ? "2. 거래처 CSV 파일 선택"
                  : "2. Select Clinic CSV File"}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 py-6 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/30"
            >
              <Upload className="h-6 w-6 text-slate-400" />
              <span className="text-xs font-semibold text-slate-800">
                {fileName
                  ? fileName
                  : lang === "ko"
                    ? "클릭하여 CSV 파일을 업로드하세요"
                    : "Click to choose a .csv file"}
              </span>
              <span className="text-[11px] text-slate-400">
                {activeTab === "materials"
                  ? "바코드, 국문자재명, 영문자재명, 카테고리, 현재재고, 안전재고, 매입단가(KRW), 매입단가(USD)"
                  : "거래처명(치과명) 단일 열 입력"}
              </span>
            </button>
          </div>
          {/* 파싱 오류 표시 */}
          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="mb-1 flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span>제외된 행 ({parseErrors.length}건)</span>
              </div>
              <ul className="max-h-24 list-inside list-disc space-y-0.5 overflow-y-auto text-[11px]">
                {parseErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 서버 오류 표시 */}
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* 자재 미리보기 테이블 */}
          {activeTab === "materials" && materialRows.length > 0 && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  등록 가능 품목: 총 {materialRows.length}건
                </span>
                <span className="text-[11px] text-slate-500">상위 5개 미리보기</span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">바코드</th>
                      <th className="px-2.5 py-1.5 font-semibold">자재명</th>
                      <th className="px-2.5 py-1.5 font-semibold">카테고리</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">재고</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">단가(₩/$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {materialRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-2.5 py-1.5 font-mono text-slate-600">
                          {row.barcode}
                        </td>
                        <td className="px-2.5 py-1.5 font-medium text-slate-900">
                          {row.name}
                        </td>
                        <td className="px-2.5 py-1.5">{row.category}</td>
                        <td className="px-2.5 py-1.5 text-right">{row.stock}</td>
                        <td className="px-2.5 py-1.5 text-right">
                          ₩{row.unitCostKRW.toLocaleString()} / ${row.unitCostUSD}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 거래처 미리보기 테이블 */}
          {activeTab === "clinics" && clinicRows.length > 0 && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  등록 가능 거래처: 총 {clinicRows.length}곳
                </span>
                <span className="text-[11px] text-slate-500">상위 5개 미리보기</span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="w-14 px-2.5 py-1.5 font-semibold">번호</th>
                      <th className="px-2.5 py-1.5 font-semibold">거래처명 (치과명)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {clinicRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-2.5 py-1.5 text-slate-500">{idx + 1}</td>
                        <td className="px-2.5 py-1.5 font-medium text-slate-900">
                          {row.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {lang === "ko" ? "취소" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={validCount === 0 || isUploading}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {lang === "ko"
              ? `${validCount}${activeTab === "materials" ? "건" : "곳"} 일괄 등록하기`
              : `Import ${validCount} Items`}
          </button>
        </div>
      </div>
    </div>
  );
}