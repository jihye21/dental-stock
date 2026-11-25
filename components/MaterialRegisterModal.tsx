"use client";

import React, { useState, useEffect } from "react";
import { X, PackagePlus, Barcode, Loader2, Trash2 } from "lucide-react";
import { Language, MaterialItem } from "@/types/inventory";

interface MaterialRegisterModalProps {
  isOpen: boolean;
  lang: Language;
  labId: string;
  initialBarcode?: string; // 미등록 바코드 스캔 시 자동 전달됨
  isUnregisteredPrompt?: boolean; // 미등록 안내 배너 표시 여부
  editingMaterial?: MaterialItem | null; //기존 자재 조회/삭제
  onClose: () => void;
  onSuccess: (createdMaterial: any) => void;
  onDeleteSuccess?: (deletedMaterialId: string) => void;
}

const CATEGORIES = ["보철", "임플란트", "세라믹", "디지털", "소모품"];

export default function MaterialRegisterModal({
  isOpen,
  lang,
  labId,
  initialBarcode = "",
  isUnregisteredPrompt = false,
  editingMaterial = null,
  onClose,
  onSuccess,
  onDeleteSuccess,
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isEditMode = Boolean(editingMaterial);

  // 모달이 열릴 때마다 초기 바코드 및 폼 상태 세팅
  useEffect(() => {
    if (!isOpen) return;

    if (editingMaterial) {
      setBarcode(editingMaterial.barcode || initialBarcode || "");
      setCategory(editingMaterial.category || CATEGORIES[0]);
      setName(editingMaterial.name);
      setNameEn(editingMaterial.nameEn || "");
      setStock(editingMaterial.stock);
      setSafeStock(editingMaterial.safeStock);
      setUnitCostKRW(editingMaterial.unitCostKRW);
      setUnitCostUSD(editingMaterial.unitCostUSD);
    } else {
      setBarcode(initialBarcode);
      setCategory(CATEGORIES[0]);
      setName("");
      setNameEn("");
      setStock(isUnregisteredPrompt ? 1 : 10);
      setSafeStock(5);
      setUnitCostKRW(0);
      setUnitCostUSD(0);
    }
    setErrorMsg(null);
  }, [isOpen, initialBarcode, editingMaterial, isUnregisteredPrompt]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSaving || isDeleting) return;
      
      if (!barcode.trim() || !name.trim()) {
        setErrorMsg("바코드와 자재명을 모두 입력해 주세요.");
        return;
      }

    setIsSaving(true);
    setErrorMsg(null);

      try {
      const url = isEditMode
        ? `/api/materials/${editingMaterial!.id}`
        : "/api/materials";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          barcode: barcode.trim(),
          category,
          name: name.trim(),
          nameEn: nameEn.trim(),
          stock: Number(stock),
          safeStock: Number(safeStock),
          unitCostKRW: Number(unitCostKRW),
          unitCostUSD: Number(unitCostUSD),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "저장에 실패했습니다.");
      }

      onSuccess(data.material);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

    //등록된 바코드 삭제 처리
    const handleDelete = async () => {
      if (!editingMaterial?.id || !onDeleteSuccess || isSaving || isDeleting) return;

      const confirmMessage =
        lang === "ko"
          ? `'${editingMaterial.name} (${editingMaterial.barcode})' 삭제하시겠습니까?\n(
        기존 입·출고 내역은 유지되며, 재고 목록에서만 제외됩니다.)`
          : `Delete '${editingMaterial.name} (${editingMaterial.barcode})'?\n(Existing log will remain intact.)`;

      if (!window.confirm(confirmMessage)) return;

      setIsDeleting(true);
      setErrorMsg(null);

      try {
        const res = await fetch(`/api/materials/${editingMaterial.id}`, {
          method: "DELETE",
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) {
          throw new Error(data.error || "삭제에 실패했습니다.");
        }

        onDeleteSuccess(editingMaterial.id);
        onClose();
      } catch (err: any) {
        setErrorMsg(err.mesage);
      } finally {
        setIsDeleting(false);
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
                  {isEditMode
                    ? lang === "ko"
                      ? "등록 자재 정보 수정 및 삭제"
                      : "Edit or Delete Material"
                    : lang === "ko"
                      ? "신규 기공 자재 및 바코드 등록"
                      : "Register New Material & Barcode"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEditMode
                    ? lang === "ko"
                      ? "등록된 자재 정보를 수정하거나 목록에서 삭제할 수 있습니다."
                      : "Update material info or remove from active inventory."
                    : lang === "ko"
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

          {isUnregisteredPrompt && !isEditMode && (
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

          {/* 입력 폼 */}
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  바코드 / SKU * {isEditMode && <span className="text-slate-400">(수정 불가)</span>}
                </label>
                <div className="relative">
                  <Barcode className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={isEditMode}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                    placeholder="예: ZIR-A2-98"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pr-3 pl-9 font-mono text-sm font-semibold focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
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
                  autoFocus={isUnregisteredPrompt && !isEditMode}
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
                  {isEditMode ? "현재 재고 수량" : "초기 재고 수량"}
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

            {/* 하단 버튼 */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              {isEditMode ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving || isDeleting}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {lang === "ko" ? "바코드 삭제" : "Delete Barcode"}
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving || isDeleting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {lang === "ko" ? "취소" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isDeleting}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEditMode
                    ? lang === "ko"
                      ? "수정 내용 저장"
                      : "Save Changes"
                    : lang === "ko"
                      ? "자재 등록 완료"
                      : "Save Material"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
}