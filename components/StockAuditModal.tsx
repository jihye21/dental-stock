// components/StockAuditModal.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  ClipboardCheck,
  Search,
  AlertCircle,
  Loader2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Language, MaterialItem } from "@/types/inventory";

interface StockAuditModalProps {
  isOpen: boolean;
  lang: Language;
  labId: string;
  inventory: Record<string, MaterialItem>;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const AUDIT_REASONS_KO = [
  "정기 월말 재고 실사",
  "파손 / 불량 / 유효기간 만료 폐기",
  "입·출고 스캔 누락 보정",
  "샘플 / 테스트 소모",
];

const AUDIT_REASONS_EN = [
  "Monthly Physical Inventory Count",
  "Damaged / Defective / Expired Disposal",
  "Missed Barcode Scan Correction",
  "Sample / Internal Testing Usage",
];

export default function StockAuditModal({
  isOpen,
  lang,
  labId,
  inventory,
  onClose,
  onSuccess,
}: StockAuditModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [reason, setReason] = useState("");
  const [actualStocks, setActualStocks] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const materials = useMemo(() => {
    return Object.values(inventory)
      .filter((item) => Boolean(item.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory]);

  // 모달이 열릴 때 전산 재고값으로 초기 입력값 세팅
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      materials.forEach((m) => {
        if (m.id) initial[m.id] = String(m.stock);
      });
      setActualStocks(initial);
      setReason(lang === "ko" ? AUDIT_REASONS_KO[0] : AUDIT_REASONS_EN[0]);
      setSearchQuery("");
      setShowDiffOnly(false);
      setErrorMsg(null);
    }
  }, [isOpen, materials, lang]);

  // 차이가 발생한 품목 목록 계산
  const changedItems = useMemo(() => {
    return materials
      .map((m) => {
        if (!m.id) return null;
        const raw = actualStocks[m.id];
        const parsed = raw === "" || raw === undefined ? m.stock : Number(raw);
        const safeActual = isNaN(parsed) ? m.stock : Math.max(0, Math.floor(parsed));
        const diff = safeActual - m.stock;
        return {
          materialId: m.id,
          barcode: m.barcode || "",
          name: m.name,
          systemStock: m.stock,
          actualStock: safeActual,
          diff,
          costDiffKRW: diff * m.unitCostKRW,
          costDiffUSD: diff * m.unitCostUSD,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.diff !== 0);
  }, [materials, actualStocks]);

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return materials.filter((m) => {
      if (!m.id) return false;
      const raw = actualStocks[m.id];
      const parsed = raw === "" || raw === undefined ? m.stock : Number(raw);
      const diff = (isNaN(parsed) ? m.stock : Math.floor(parsed)) - m.stock;

      if (showDiffOnly && diff === 0) return false;
      if (!q) return true;

      return (
        m.name.toLowerCase().includes(q) ||
        (m.barcode || "").toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [materials, searchQuery, showDiffOnly, actualStocks]);

  if (!isOpen) return null;

  const handleStockInput = (materialId: string, value: string) => {
    // 숫자만 허용 (빈 문자열은 입력 중 지우기 허용)
    if (value === "" || /^\d+$/.test(value)) {
      setActualStocks((prev) => ({ ...prev, [materialId]: value }));
    }
  };

  const handleResetRow = (materialId: string, systemStock: number) => {
    setActualStocks((prev) => ({ ...prev, [materialId]: String(systemStock) }));
  };

  const handleSubmit = async () => {
    if (changedItems.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/materials/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          reason,
          items: changedItems.map((c) => ({
            materialId: c.materialId,
            actualStock: c.actualStock,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "실사 재고 조정에 실패했습니다.");
      }

      const msg =
        lang === "ko"
          ? `실사 재고 조정이 완료되었습니다. (총 ${data.adjustedCount}개 품목 반영)`
          : `Stock audit completed (${data.adjustedCount} items adjusted).`;

      onSuccess(msg);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "서버 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonsList = lang === "ko" ? AUDIT_REASONS_KO : AUDIT_REASONS_EN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {lang === "ko" ? "실사 재고 조정 (Stock Audit)" : "Physical Stock Audit"}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === "ko"
                  ? "창고의 실제 수량을 입력하면 전산 재고와의 차이만큼 자동 보정됩니다."
                  : "Enter actual counted quantities to reconcile discrepancies."}
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

        {/* 상단 컨트롤 바: 조정 사유 + 검색 + 필터 */}
        <div className="space-y-3 border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
          {/* 조정 사유 선택 및 직접 입력 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="shrink-0 text-xs font-bold text-slate-700">
              {lang === "ko" ? "조정 사유" : "Audit Reason"}
            </label>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {reasonsList.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                    reason === preset
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {preset}
                </button>
              ))}
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={lang === "ko" ? "조정 사유 직접 입력..." : "Enter reason..."}
                className="min-w-[180px] flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 품목 검색 & 차이 품목 필터 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === "ko"
                    ? "바코드, 자재명, 카테고리로 검색..."
                    : "Search by barcode, name, category..."
                }
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowDiffOnly((prev) => !prev)}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                showDiffOnly
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {lang === "ko"
                ? `차이 발생 품목만 보기 (${changedItems.length}건)`
                : `Discrepancies Only (${changedItems.length})`}
            </button>
          </div>
        </div>

        {/* 재고 실사 입력 테이블 */}
        <div className="flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="m-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-2.5">바코드 / 품목명</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">카테고리</th>
<th className="px-3 py-2.5 text-right">전산 재고</th>
                <th className="w-28 px-3 py-2.5 text-center">실사 수량</th>
                <th className="w-20 px-3 py-2.5 text-right">차이</th>
                <th className="w-14 px-3 py-2.5 text-center">초기화</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-xs text-slate-400"
                  >
                    {lang === "ko"
                      ? "조건에 해당하는 자재가 없습니다."
                      : "No matching materials found."}
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((item) => {
                  const matId = item.id!;
                  const rawVal = actualStocks[matId] ?? String(item.stock);
                  const numericVal = rawVal === "" ? item.stock : Number(rawVal);
                  const diff = numericVal - item.stock;

                  return (
                    <tr
                      key={matId}
                      className={`transition ${
                        diff !== 0 ? "bg-amber-50/50" : "hover:bg-slate-50/70"
                      }`}
                    >
                      {/* 바코드 / 품목명 */}
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-[11px] text-slate-400">
                          {item.barcode}
                        </div>
                        <div className="font-medium text-slate-900">
                          {lang === "ko" ? item.name : item.nameEn || item.name}
                        </div>
                      </td>

                      {/* 카테고리 */}
                      <td className="hidden px-3 py-2.5 text-slate-600 sm:table-cell">
                        {item.category}
                      </td>

                      {/* 전산 재고 */}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700">
                        {item.stock}
                      </td>

                      {/* 실사 수량 입력 */}
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          value={rawVal}
                          onChange={(e) =>
                            setActualStocks((prev) => ({
                              ...prev,
                              [matId]: e.target.value,
                            }))
                          }
                          className={`w-20 rounded-lg border px-2 py-1 text-center text-xs font-bold outline-none transition ${
                            diff !== 0
                              ? "border-amber-400 bg-white text-amber-900 ring-2 ring-amber-100"
                              : "border-slate-200 bg-slate-50 text-slate-800 focus:border-slate-400 focus:bg-white"
                          }`}
                        />
                      </td>

                      {/* 차이 */}
                      <td className="px-3 py-2.5 text-right font-bold">
                        {diff === 0 ? (
                          <span className="text-slate-300">-</span>
                        ) : diff > 0 ? (
                          <span className="text-emerald-600">+{diff}</span>
                        ) : (
                          <span className="text-rose-600">{diff}</span>
                        )}
                      </td>

                      {/* 개별 초기화 */}
                      <td className="px-3 py-2.5 text-center">
                        {diff !== 0 && (
                          <button
                            type="button"
                            title="전산 재고로 되돌리기"
                            onClick={() =>
                              setActualStocks((prev) => {
                                const next = { ...prev };
                                delete next[matId];
                                return next;
                              })
                            }
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 모달 푸터 */}
        <div className="flex flex-col justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 sm:flex-row sm:items-center">
          <div className="text-xs">
            {changedItems.length > 0 ? (
              <span className="font-medium text-slate-700">
                {lang === "ko" ? "조정 대상: " : "Items to adjust: "}
                <strong className="font-bold text-amber-700">
                  {changedItems.length}개 품목
                </strong>
              </span>
            ) : (
              <span className="text-slate-400">
                {lang === "ko"
                  ? "수량이 변경된 품목이 없습니다."
                  : "No stock changes detected."}
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {lang === "ko" ? "취소" : "Cancel"}
            </button>

            <button
              type="button"
              disabled={changedItems.length === 0 || isSubmitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {lang === "ko"
                ? `${changedItems.length}건 실사 재고 반영하기`
                : `Apply ${changedItems.length} Adjustments`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}