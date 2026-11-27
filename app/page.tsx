"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, History, Loader2, RotateCcw, Download } from "lucide-react";
import Header from "@/components/Header";
import BarcodeScannerBox from "@/components/BarcodeScannerBox";
import AnalyticsSection from "@/components/AnalyticsSection";
import MaterialRegisterModal from "@/components/MaterialRegisterModal";
import ClinicRegisterModal from "@/components/ClinicRegisterModal";
import CsvBulkModal from "@/components/CsvBulkModal";
import StockAuditModal from "@/components/StockAuditModal";

import {
  Clinic,
  I18N,
  Language,
  MaterialItem,
} from "@/types/inventory";

import { useDashboardData } from "@/hooks/useDashboardData";
import { useBarcodeScan } from "@/hooks/useBarcodeScan";
import { useCsvExport } from "@/hooks/useCsvExport";

const TEMP_LAB_ID = "default-dental-lab";

export default function DentalLabDashboard() {
  const [lang, setLang] = useState<Language>("ko");
  const t = I18N[lang];

  // 순수 UI 상태만 남김 (useRef, isLoading, isSubmitting, clinics, inventory, scanLogs, isExporting 제거됨)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const [clinicModal, setClinicModal] = useState<{
    isOpen: boolean;
    prefillName: string;
    editingClinic: Clinic | null;
  }>({
    isOpen: false,
    prefillName: "",
    editingClinic: null,
  });

  const [registerModal, setRegisterModal] = useState<{
    isOpen: boolean;
    barcode: string;
    isUnregisteredPrompt: boolean;
    editingMaterial: MaterialItem | null;
  }>({
    isOpen: false,
    barcode: "",
    isUnregisteredPrompt: false,
    editingMaterial: null,
  });

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // 1. 서버 데이터 및 정합성 동기화 훅
  const {
    isLoading,
    cancellingLogId,
    clinics,
    inventory,
    setInventory,
    scanLogs,
    fetchDashboardData,
    handleCancelTransaction,
    applyScanResult,
    handleMaterialRegistered,
    handleClinicSaved,
    handleClinicDeleted,
  } = useDashboardData({
    labId: TEMP_LAB_ID,
    lang,
    onToast: setToast,
  });

  // 2. 바코드 스캔 및 중복 방지 훅
  const handleUnregisteredBarcode = useCallback((barcode: string) => {
    setRegisterModal({
      isOpen: true,
      barcode,
      isUnregisteredPrompt: true,
      editingMaterial: null,
    });
  }, []);

  const { isSubmitting, handleProcessScan } = useBarcodeScan({
    labId: TEMP_LAB_ID,
    onSuccess: applyScanResult,
    onUnregistered: handleUnregisteredBarcode,
    onToast: setToast,
  });

  // 3. CSV 내보내기 훅
  const { isExporting, handleExportCsv } = useCsvExport({
    labId: TEMP_LAB_ID,
    lang,
    onToast: setToast,
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-10 text-slate-900">
      <Header
        lang={lang}
        onToggleLang={() => setLang(lang === "ko" ? "en" : "ko")}
        onOpenRegisterModal={() =>
          setRegisterModal({
            isOpen: true,
            barcode: "",
            isUnregisteredPrompt: false,
            editingMaterial: null,
          })
        }
        onOpenBulkModal={() => setIsBulkModalOpen(true)}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onExportTransactions={() => handleExportCsv("transactions")}
        isExportingTransactions={isExporting === "transactions"}
      />

      <StockAuditModal
        isOpen={isAuditModalOpen}
        lang={lang}
        labId={TEMP_LAB_ID}
        inventory={inventory}
        onClose={() => setIsAuditModalOpen(false)}
        onSuccess={(msg) => {
          setToast({ type: "success", message: msg });
          fetchDashboardData(); // 재고 수량 및 입출고 로그 즉시 동기화
        }}
      />

      {/* CsvBulkModal 배치 */}
      <CsvBulkModal
        isOpen={isBulkModalOpen}
        lang={lang}
        labId={TEMP_LAB_ID}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={(msg) => {
          setToast({ type: "success", message: msg });
          fetchDashboardData(); // 등록 후 대시보드 재고 목록 갱신
        }}
      />

      <MaterialRegisterModal
        isOpen={registerModal.isOpen}
        lang={lang}
        labId={TEMP_LAB_ID}
        initialBarcode={registerModal.barcode}
        isUnregisteredPrompt={registerModal.isUnregisteredPrompt}
        editingMaterial={registerModal.editingMaterial}
        onClose={() =>
          setRegisterModal((prev) => ({ ...prev, isOpen: false, editingMaterial: null }))
        }
        onSuccess={handleMaterialRegistered}
        onDeleteSuccess={(deletedId) => {
          setInventory((prev) => {
            const next = { ...prev };
            const targetKey = Object.keys(next).find((k) => next[k].id === deletedId);
            if (targetKey) delete next[targetKey];
            return next;
          });
          setToast({
            type: "success",
            message: "등록된 바코드가 삭제되었습니다.",
          });
        }}
      />

      <main className="mx-auto max-w-7xl space-y-4 p-4 sm:space-y-6 sm:p-6">
        {toast && (
          <div
            className={`fixed top-16 right-3 left-3 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-2xl transition-all sm:top-20 sm:right-6 sm:left-auto sm:w-auto sm:max-w-md ${toast.type === "error" ? "bg-rose-600" : "bg-slate-900"
              }`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-200" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span className="break-keep leading-snug">{toast.message}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-slate-500">
              기공소 재고 및 거래처 데이터를 불러오는 중입니다...
            </p>
          </div>
        ) : (
          <>
            <BarcodeScannerBox
              lang={lang}
              clinics={clinics}
              selectedClinicId={selectedClinicId}
              onSelectClinic={setSelectedClinicId}
              onOpenClinicModal={(prefillName = "") =>
                setClinicModal({ isOpen: true, prefillName, editingClinic: null })
              }
              onEditClinic={(clinic) =>
                setClinicModal({ isOpen: true, prefillName: "", editingClinic: clinic })
              }
              onEditMaterial={(material) =>
                setRegisterModal({
                  isOpen: true,
                  barcode: material.barcode || "",
                  isUnregisteredPrompt: false,
                  editingMaterial: material,
                })
              }
              inventory={inventory}
              onProcessScan={handleProcessScan}
            />
            <ClinicRegisterModal
              isOpen={clinicModal.isOpen}
              lang={lang}
              labId={TEMP_LAB_ID}
              initialName={clinicModal.prefillName}
              editingClinic={clinicModal.editingClinic}
              onClose={() => setClinicModal((prev) => ({ ...prev, isOpen: false }))}
              onSuccess={(savedClinic, isEdit) =>
                handleClinicSaved(savedClinic, isEdit, setSelectedClinicId)
              }
              onDeleteSuccess={(deletedId) =>
                handleClinicDeleted(deletedId, () => {
                  if (selectedClinicId === deletedId) setSelectedClinicId("");
                })
              }
            />

            <AnalyticsSection
              lang={lang}
              labId={TEMP_LAB_ID}
              inventory={inventory}
              refreshTrigger={scanLogs.length}
            />

            {/* 실시간 입·출고 내역 */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-slate-600" />
                  <h2 className="text-base font-bold text-slate-800">
                    {t.recentLogsTitle}
                  </h2>
                </div>
                {isSubmitting && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    저장 중...
                  </span>
                )}
              </div>

              {scanLogs.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  아직 기록된 바코드 입·출고 내역이 없습니다.
                </div>
              ) : (
                <>
                  {/* 모바일 전용 카드 뷰 */}
                  <div className="space-y-2.5 md:hidden">
                    {scanLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-col gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${log.type === "OUT"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                                }`}
                            >
                              {log.type === "OUT" ? "출고" : "입고"}
                            </span>
                            <span className="font-mono text-xs font-semibold text-slate-600">
                              {log.barcode}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-400">
                              {log.time}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelTransaction(log)}
                              disabled={cancellingLogId === log.id}
                              className="inline-flex items-center gap-1 rounded border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              {cancellingLogId === log.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              <span>{lang === "ko" ? "취소" : "Undo"}</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-sm font-bold text-slate-900">
                          {log.itemName}
                        </p>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{log.clinicName}</span>
                          <span className="font-semibold text-slate-800">
                            {t.currency}
                            {(lang === "ko"
                              ? log.costKRW
                              : log.costUSD
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 태블릿·PC 전용 테이블 뷰 */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-4 py-3">시간</th>
                          <th className="px-4 py-3">구분</th>
                          <th className="px-4 py-3">바코드</th>
                          <th className="px-4 py-3">자재명</th>
                          <th className="px-4 py-3">거래처</th>
                          <th className="px-4 py-3 text-right">단가 원가</th>
                          <th className="px-4 py-3 text-center">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scanLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">
                              {log.time}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${log.type === "OUT"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-emerald-100 text-emerald-700"
                                  }`}
                              >
                                {log.type === "OUT" ? "출고" : "입고"}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">
                              {log.barcode}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {log.itemName}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {log.clinicName}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900">
                              {t.currency}
                              {(lang === "ko"
                                ? log.costKRW
                                : log.costUSD
                              ).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleCancelTransaction(log)}
                                disabled={cancellingLogId === log.id}
                                title={
                                  lang === "ko"
                                    ? "내역 취소 및 재고 복구"
                                    : "Cancel & Restore Stock"
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                              >
                                {cancellingLogId === log.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                <span>{lang === "ko" ? "취소" : "Undo"}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
