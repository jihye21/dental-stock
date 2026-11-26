"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, History, Loader2, RotateCcw, Download } from "lucide-react";
import Header from "@/components/Header";
import BarcodeScannerBox from "@/components/BarcodeScannerBox";
import AnalyticsSection from "@/components/AnalyticsSection";
import MaterialRegisterModal from "@/components/MaterialRegisterModal";
import ClinicRegisterModal from "@/components/ClinicRegisterModal";
import CsvBulkModal from "@/components/CsvBulkModal";
import { downloadCsvFile } from "@/lib/csv";
import StockAuditModal from "@/components/StockAuditModal";

import {
  Clinic,
  I18N,
  Language,
  MaterialItem,
  ScanLog,
  TransactionMode,
} from "@/types/inventory";

const TEMP_LAB_ID = "default-dental-lab";

export default function DentalLabDashboard() {
  const [lang, setLang] = useState<Language>("ko");
  const t = I18N[lang];

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [inventory, setInventory] = useState<Record<string, MaterialItem>>({});
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<"materials" | "transactions" | null>(null);
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

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan?labId=${TEMP_LAB_ID}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "데이터 조회에 실패했습니다.");
      }

      const loadedClinics = data.frequentClinics || [];
      setClinics(loadedClinics);

      const inventoryMap: Record<string, MaterialItem> = {};
      (data.materials || []).forEach((item: any) => {
        inventoryMap[item.barcode] = {
          id: item.id,
          barcode: item.barcode,
          name: lang === "en" && item.nameEn ? item.nameEn : item.name,
          nameEn: item.nameEn || "",
          category: item.category,
          stock: item.stock,
          safeStock: item.safeStock,
          unitCostKRW: item.unitCostKRW,
          unitCostUSD: item.unitCostUSD,
        };
      });
      setInventory(inventoryMap);

      const formattedLogs: ScanLog[] = (data.recentLogs || []).map((log: any) => {
        const isAudit = typeof log.memo === "string" && log.memo.startsWith("[실사조정]");
        return {
          id: log.id,
          time: new Date(log.createdAt).toLocaleTimeString("ko-KR", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          type: log.type,
          barcode: log.material.barcode,
          itemName:
            lang === "en" && log.material.nameEn
              ? log.material.nameEn
              : log.material.name,
          clinicName: isAudit
            ? log.memo
            : log.clinic?.name || (lang === "ko" ? "자재 매입처" : "Supplier"),
          costKRW: log.unitCostKRW,
          costUSD: log.unitCostUSD,
        };
      });
      setScanLogs(formattedLogs);
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "서버와 연결할 수 없습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [lang]);

  const [cancellingLogId, setCancellingLogId] = useState<string | null>(null);

  const handleCancelTransaction = async (log: ScanLog) => {
    if (cancellingLogId) return;

    const actionLabel = log.type === "OUT" ? "출고" : "입고";
    const confirmMsg =
      lang === "ko"
        ? `[${actionLabel}] ${log.itemName} (${log.barcode}) 내역을 취소하시겠습니까?\n재고 수량이 자동으로 복구됩니다.`
        : `Cancel [${log.type}] ${log.itemName} (${log.barcode})?\nStock quantity will be restored.`;

    if (!window.confirm(confirmMsg)) return;

    setCancellingLogId(log.id);
    try {
      const res = await fetch(`/api/scan/${log.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "취소 처리에 실패했습니다.");
      }

      // 1. 로그 목록에서 즉시 제거
      setScanLogs((prev) => prev.filter((item) => item.id !== log.id));

      // 2. 현재 재고(inventory) 수량 즉시 동기화
      if (data.material) {
        setInventory((prev) => {
          if (!prev[log.barcode]) return prev;
          return {
            ...prev,
            [log.barcode]: {
              ...prev[log.barcode],
              stock: data.material.stock,
            },
          };
        });
      }

      setToast({
        type: "success",
        message:
          lang === "ko"
            ? `${actionLabel}가 취소되고 재고가 복구되었습니다.`
            : "Transaction cancelled and stock restored.",
      });
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "취소 처리 중 오류가 발생했습니다.",
      });
    } finally {
      setCancellingLogId(null);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleProcessScan = async (
    code: string,
    mode: TransactionMode,
    clinicId: string
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId: TEMP_LAB_ID,
          barcode: code,
          type: mode,
          clinicId: mode === "OUT" ? clinicId : undefined,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404 && data.code === "UNREGISTERED_BARCODE") {
          setRegisterModal({
            isOpen: true,
            barcode: data.barcode || code,
            isUnregisteredPrompt: true,
            editingMaterial: null,
          });
          return;
        }

        setToast({
          type: "error",
          message: `⚠️ ${data.error || "처리 중 오류가 발생했습니다."}`,
        });
        return;
      }

      const updatedMat = data.material;
      setInventory((prev) => ({
        ...prev,
        [updatedMat.barcode]: {
          ...prev[updatedMat.barcode],
          stock: updatedMat.stock,
        },
      }));

      const tx = data.transaction;
      const clinicName =
        tx.clinic?.name || (lang === "ko" ? "자재 매입처" : "Supplier");

      const newLog: ScanLog = {
        id: tx.id,
        time: new Date(tx.createdAt).toLocaleTimeString("ko-KR", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        type: tx.type,
        barcode: tx.material.barcode,
        itemName:
          lang === "en" && tx.material.nameEn
            ? tx.material.nameEn
            : tx.material.name,
        clinicName,
        costKRW: tx.unitCostKRW,
        costUSD: tx.unitCostUSD,
      };

      setScanLogs((prev) => [newLog, ...prev.slice(0, 9)]);

      if (mode === "OUT" && clinicId) {
        setClinics((prev) =>
          prev
            .map((c) => (c.id === clinicId ? { ...c, count: c.count + 1 } : c))
            .sort((a, b) => b.count - a.count)
        );
      }

      setToast({
        type: "success",
        message: `✅ [${mode === "OUT" ? "출고" : "입고"}] ${newLog.itemName} → ${clinicName} (잔여: ${updatedMat.stock}개)`,
      });
    } catch {
      setToast({
        type: "error",
        message: "⚠️ 네트워크 오류로 바코드 처리에 실패했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaterialRegistered = (newMat: any) => {
    setInventory((prev) => ({
      ...prev,
      [newMat.barcode]: {
        name: lang === "en" && newMat.nameEn ? newMat.nameEn : newMat.name,
        category: newMat.category,
        stock: newMat.stock,
        safeStock: newMat.safeStock,
        unitCostKRW: newMat.unitCostKRW,
        unitCostUSD: newMat.unitCostUSD,
      },
    }));

    setToast({
      type: "success",
      message: `✅ 신규 자재 등록 완료: [${newMat.barcode}] ${newMat.name}`,
    });
  };

  const handleClinicSaved = (savedClinic: Clinic, isEdit: boolean) => {
    if (isEdit) {
      setClinics((prev) =>
        prev.map((c) => (c.id === savedClinic.id ? savedClinic : c))
      );
      setToast({
        type: "success",
        message: `✅ 거래처 정보가 수정되었습니다.`,
      });
    } else {
      setClinics((prev) => [...prev, savedClinic]);
      setSelectedClinicId(savedClinic.id);
      setToast({
        type: "success",
        message: `✅ 새 거래처가 등록되었습니다.`,
      });
    }
  };

  const handleDeleteClinic = async (clinicId: string) => {
    try {
      // TODO: DB 삭제 API 호출
      setClinics((prev) => prev.filter((c) => c.id !== clinicId));

      //현재 선택된 거래처가 삭제된 경우 선택 초기화
      if (selectedClinicId === clinicId) {
        setSelectedClinicId("");
      }
      setToast({
        type: "success",
        message: `✅ 거래처가 삭제되었습니다.`,
      });
    } catch (error) {
      setToast({
        type: "error",
        message: `⚠️ ${error || "거래처 삭제 중 오류가 발생했습니다."}`,
      });
    }
  }
  const handleClinicRegistered = (newClinic: Clinic) => {
    setClinics((prev) => [newClinic, ...prev]);
    setSelectedClinicId(newClinic.id);
    setToast({
      type: "success",
      message: `✅ 신규 거래처 등록 완료: [${newClinic.name}]`,
    });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleExportCsv = async (target: "materials" | "transactions") => {
    if (isExporting) return;
    setIsExporting(target);

    try {
      const res = await fetch(`/api/export?labId=${TEMP_LAB_ID}&target=${target}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "다운로드 데이터를 불러오지 못했습니다.");
      }

      const todayStr = new Date().toISOString().slice(0, 10);

      if (target === "materials") {
        const headers = [
          "바코드",
          "국문자재명",
          "영문자재명",
          "카테고리",
          "현재재고",
          "안전재고",
          "매입단가_KRW",
          "매입단가_USD",
          "재고자산가치_KRW",
        ];
        const rows = (data.materials || []).map((m: any) => [
          m.barcode,
          m.name,
          m.nameEn || "",
          m.category,
          m.stock,
          m.safeStock,
          m.unitCostKRW,
          m.unitCostUSD,
          m.stock * m.unitCostKRW,
        ]);

        downloadCsvFile(`dental-stock-inventory-${todayStr}.csv`, headers, rows);
      } else {
        const headers = [
          "일시",
          "구분",
          "바코드",
          "카테고리",
          "자재명",
          "거래처(치과)",
          "수량",
          "단가_KRW",
          "합계금액_KRW",
          "단가_USD",
          "합계금액_USD",
          "메모",
        ];
        const rows = (data.transactions || []).map((tx: any) => [
          new Date(tx.createdAt).toLocaleString("ko-KR"),
          tx.type === "OUT" ? "출고" : "입고",
          tx.material?.barcode || "",
          tx.material?.category || "",
          tx.material?.name || "",
          tx.clinic?.name || "자재 매입처",
          tx.quantity,
          tx.unitCostKRW,
          tx.quantity * tx.unitCostKRW,
          tx.unitCostUSD,
          Number((tx.quantity * tx.unitCostUSD).toFixed(2)),
          tx.memo || "",
        ]);

        downloadCsvFile(`dental-stock-history-${todayStr}.csv`, headers, rows);
      }

      setToast({
        type: "success",
        message:
          lang === "ko"
            ? "엑셀(CSV) 파일 다운로드가 완료되었습니다."
            : "CSV file downloaded successfully.",
      });
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "다운로드 중 오류가 발생했습니다.",
      });
    } finally {
      setIsExporting(null);
    }
  };

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

      <ClinicRegisterModal
        isOpen={clinicModal.isOpen}
        lang={lang}
        labId={TEMP_LAB_ID}
        initialName={clinicModal.prefillName}
        onClose={() => setClinicModal((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={handleClinicRegistered}
      />

      <main className="mx-auto max-w-7xl space-y-4 p-4 sm:space-y-6 sm:p-6">
        {toast && (
          <div
            className={`fixed right-4 bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium text-white shadow-xl transition-all sm:static sm:rounded-lg sm:py-3 sm:shadow-md ${toast.type === "error" ? "bg-rose-600" : "bg-slate-900"
              }`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-200" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span className="leading-snug">{toast.message}</span>
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
              onSuccess={(savedClinic, isEdit) => {
                if (isEdit) {
                  setClinics((prev) =>
                    prev.map((c) => (c.id === savedClinic.id ? savedClinic : c))
                  );
                  setToast({
                    type: "success",
                    message: "거래처 정보가 수정되었습니다.",
                  });
                } else {
                  setClinics((prev) => [...prev, savedClinic]);
                  setSelectedClinicId(savedClinic.id);
                  setToast({
                    type: "success",
                    message: "새 거래처가 등록되었습니다.",
                  });
                }
              }}
              onDeleteSuccess={(deletedId) => {
                setClinics((prev) => prev.filter((c) => c.id !== deletedId));
                if (selectedClinicId === deletedId) setSelectedClinicId("");
                setToast({
                  type: "success",
                  message: "거래처가 삭제되었습니다.",
                });
              }}
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
