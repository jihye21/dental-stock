"use client";

import React, { useState, useEffect } from "react";
import { X, PackagePlus, Barcode, Loader2 } from "lucide-react";
import { Language } from "@/types/inventory";

interface MaterialRegisterModalProps {
  isOpen: boolean;
  lang: Language;
  labId: string;
  initialBarcode?: string; // 미등록 바코드 스캔 시 자동 전달됨
  isUnregisteredPrompt?: boolean; // 미등록 안내 배너 표시 여부
  onClose: () => void;
  onSuccess: (createdMaterial: any) => void;
}

const CATEGORIES = ["보철", "임플란트", "세라믹", "디지털", "소모품"];

export default function MaterialRegisterModal({
  isOpen,
  lang,
  labId,
  initialBarcode = "",
  isUnregisteredPrompt = false,
  onClose,
  onSuccess,
}: MaterialRegisterModalProps) {
  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [stock, setStock] = useState<number>(10);
  const [safeStock, setSafeStock] = useState<number>(5);
  const [unitCostKRW, setUnitCostKRW] = useState<number>(0);
  const [unitCostUSD, setUnitCostUSD] = useState<number>(0);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 모달이 열릴 때마다 초기 바코드 및 폼 상태 세팅
  useEffect(() => {
    if (isOpen) {
      setBarcode(initialBarcode);
      setName("");
      setNameEn("");
      setCategory(CATEGORIES[0]);
      setStock(isUnregisteredPrompt ? 1 : 10);
      setSafeStock(5);
      setUnitCostKRW(0);
      setUnitCostUSD(0);
      setErrorMsg(null);
    }
  }, [isOpen, initialBarcode, isUnregisteredPrompt]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          barcode,
          name,
          nameEn,
          category,
          stock,
          safeStock,
          unitCostKRW,
          unitCostUSD,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "등록에 실패했습니다.");
      }

      onSuccess(data.material);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {lang === "ko" ? "신규 기공 자재 및 바코드 등록" : "Register New Material & Barcode"}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === "ko"
                  ? "스캔한 바코드를 마스터 DB에 등록합니다."
                  : "Add new barcode item to master inventory."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 미등록 바코드 스캔으로 열린 경우 안내 배너 */}
        {isUnregisteredPrompt && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <p className="font-bold">⚠️ DB에 등록되지 않은 바코드입니다.</p>
            <p className="mt-0.5">
              이 바코드(<span className="font-mono font-bold">{initialBarcode}</span>)를 지금 바로 신규 자재로 등록하시겠습니까?
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 rounded-lg bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-600">
            {errorMsg}
          </div>
        )}

        {/* 등록 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                바코드 / SKU *
              </label>
              <div className="relative">
                <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                  placeholder="예: ZIR-A2-98"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 font-mono text-sm font-semibold focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                자재 카테고리 *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                자재명 (국문) *
              </label>
              <input
                type="text"
                required
                autoFocus={isUnregisteredPrompt}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 지르코니아 블록 A3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                자재명 (영문 - 해외 확장용)
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Zirconia Block A3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                초기 재고 수량
              </label>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                안전재고 기준
              </label>
              <input
                type="number"
                min={0}
                value={safeStock}
                onChange={(e) => setSafeStock(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                매입 단가 (₩)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={unitCostKRW}
                onChange={(e) => setUnitCostKRW(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                매입 단가 ($)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={unitCostUSD}
                onChange={(e) => setUnitCostUSD(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* 하단 액션 버튼 */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ko" ? "자재 등록 완료" : "Save Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}