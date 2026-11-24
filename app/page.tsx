"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, History } from "lucide-react";
import Header from "@/components/Header";
import BarcodeScannerBox from "@/components/BarcodeScannerBox";
import AnalyticsSection from "@/components/AnalyticsSection";
import {
  Clinic,
  I18N,
  Language,
  MaterialItem,
  ScanLog,
  TransactionMode,
} from "@/types/inventory";

const INITIAL_CLINICS: Clinic[] = [
  { id: "c1", name: "서울탑치과", count: 42 },
  { id: "c2", name: "연세미소치과", count: 38 },
  { id: "c3", name: "강남플란트치과", count: 29 },
  { id: "c4", name: "바른이교정치과", count: 21 },
  { id: "c5", name: "화이트라인치과", count: 18 },
  { id: "c6", name: "더웰치과병원", count: 14 },
];

const INITIAL_INVENTORY: Record<string, MaterialItem> = {
  "ZIR-A2-98": { name: "지르코니아 블록 A2 (98mm)", category: "보철", stock: 24, safeStock: 10, unitCostKRW: 65000, unitCostUSD: 48 },
  "TI-PRE-10": { name: "티타늄 환봉 프리밀 10mm", category: "임플란트", stock: 8, safeStock: 15, unitCostKRW: 22000, unitCostUSD: 16 },
  "LITH-HT-B1": { name: "리튬디실리케이트 인곳 B1", category: "세라믹", stock: 45, safeStock: 20, unitCostKRW: 18000, unitCostUSD: 13 },
  "RES-3D-1KG": { name: "3D프린터 모델 레진 (1kg)", category: "디지털", stock: 12, safeStock: 5, unitCostKRW: 85000, unitCostUSD: 62 },
};

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

  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([
    {
      id: "log-1",
      time: "09:24:12",
      type: "OUT",
      barcode: "ZIR-A2-98",
      itemName: "지르코니아 블록 A2 (98mm)",
      clinicName: "서울탑치과",
      costKRW: 65000,
      costUSD: 48,
    },
  ]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleProcessScan = (code: string, mode: TransactionMode, clinicId: string) => {
    const targetItem = inventory[code];
    const clinicObj = INITIAL_CLINICS.find((c) => c.id === clinicId);
    const clinicName = mode === "OUT" ? clinicObj?.name || "일반 거래처" : "자재 매입처";

    if (!targetItem) {
      setToastMessage(`⚠️ 미등록 바코드입니다: ${code}`);
      return;
    }

    const delta = mode === "OUT" ? -1 : 1;
    setInventory((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        stock: Math.max(0, prev[code].stock + delta),
      },
    }));

    const now = new Date().toTimeString().split(" ")[0];
    const newLog: ScanLog = {
      id: `log-${Date.now()}`,
      time: now,
      type: mode,
      barcode: code,
      itemName: targetItem.name,
      clinicName,
      costKRW: targetItem.unitCostKRW,
      costUSD: targetItem.unitCostUSD,
    };

    setScanLogs((prev) => [newLog, ...prev.slice(0, 9)]);
    setToastMessage(`✅ [${mode === "OUT" ? "출고" : "입고"}] ${targetItem.name} → ${clinicName} 처리 완료`);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header lang={lang} onToggleLang={() => setLang(lang === "ko" ? "en" : "ko")} />

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {toastMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        <BarcodeScannerBox
          lang={lang}
          clinics={INITIAL_CLINICS}
          inventory={inventory}
          onProcessScan={handleProcessScan}
        />

        <AnalyticsSection lang={lang} inventory={inventory} monthlyData={MONTHLY_CHART_DATA} />

        {/* 실시간 입·출고 내역 테이블 */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-slate-600" />
            <h2 className="text-base font-bold text-slate-800">{t.recentLogsTitle}</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
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
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.time}</td>
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
                    <td className="px-4 py-3 font-medium text-slate-900">{log.itemName}</td>
                    <td className="px-4 py-3 text-slate-600">{log.clinicName}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {t.currency}
                      {(lang === "ko" ? log.costKRW : log.costUSD).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
