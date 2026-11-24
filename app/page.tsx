"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, History, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import BarcodeScannerBox from "@/components/BarcodeScannerBox";
import AnalyticsSection from "@/components/AnalyticsSection";
import MaterialRegisterModal from "@/components/MaterialRegisterModal";
import ClinicRegisterModal from "@/components/ClinicRegisterModal";
import {
  Clinic,
  I18N,
  Language,
  MaterialItem,
  ScanLog,
  TransactionMode,
} from "@/types/inventory";

const TEMP_LAB_ID = "default-dental-lab";

const MONTHLY_CHART_DATA = [
  { month: "6월", costKRW: 420, costUSD: 3100, usage: 180 },
  { month: "7월", costKRW: 480, costUSD: 3500, usage: 210 },
  { month: "8월", costKRW: 450, costUSD: 3300, usage: 195 },
  { month: "9월", costKRW: 530, costUSD: 3900, usage: 240 },
  { month: "10월", costKRW: 510, costUSD: 3750, usage: 225 },
  { month: "11월", costKRW: 590, costUSD: 4350, usage: 265 },
];

export default function DentalLabDashboard() {
  const [lang, setLang] = useState<Language>("ko");
  const t = I18N[lang];

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [inventory, setInventory] = useState<Record<string, MaterialItem>>({});
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);

  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [clinicModal, setClinicModal] = useState<{
    isOpen: boolean;
    prefillName: string;
  }>({
    isOpen: false,
    prefillName: "",
  });

  const [registerModal, setRegisterModal] = useState<{
    isOpen: boolean;
    barcode: string;
    isUnregisteredPrompt: boolean;
  }>({
    isOpen: false,
    barcode: "",
    isUnregisteredPrompt: false,
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
      if (loadedClinics.length > 0) {
        setSelectedClinicId((prev) => prev || loadedClinics[0].id);
      }

      const inventoryMap: Record<string, MaterialItem> = {};
      (data.materials || []).forEach((item: any) => {
        inventoryMap[item.barcode] = {
          name: lang === "en" && item.nameEn ? item.nameEn : item.name,
          category: item.category,
          stock: item.stock,
          safeStock: item.safeStock,
          unitCostKRW: item.unitCostKRW,
          unitCostUSD: item.unitCostUSD,
        };
      });
      setInventory(inventoryMap);

      const formattedLogs: ScanLog[] = (data.recentLogs || []).map((log: any) => ({
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
        clinicName: log.clinic?.name || (lang === "ko" ? "자재 매입처" : "Supplier"),
        costKRW: log.unitCostKRW,
        costUSD: log.unitCostUSD,
      }));
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
          })
        }
      />

      <MaterialRegisterModal
        isOpen={registerModal.isOpen}
        lang={lang}
        labId={TEMP_LAB_ID}
        initialBarcode={registerModal.barcode}
        isUnregisteredPrompt={registerModal.isUnregisteredPrompt}
        onClose={() =>
          setRegisterModal((prev) => ({ ...prev, isOpen: false }))
        }
        onSuccess={handleMaterialRegistered}
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
            className={`fixed right-4 bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium text-white shadow-xl transition-all sm:static sm:rounded-lg sm:py-3 sm:shadow-md ${
              toast.type === "error" ? "bg-rose-600" : "bg-slate-900"
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
                setClinicModal({ isOpen: true, prefillName })
              }
              inventory={inventory}
              onProcessScan={handleProcessScan}
            />

                        <AnalyticsSection
              lang={lang}
              inventory={inventory}
              monthlyData={MONTHLY_CHART_DATA}
            />

            {/* 실시간 입·출고 내역 (모바일: 카드 / 데스크톱: 테이블) */}
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
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                log.type === "OUT"
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
                          <span className="font-mono text-[11px] text-slate-400">
                            {log.time}
                          </span>
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
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  log.type === "OUT"
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
