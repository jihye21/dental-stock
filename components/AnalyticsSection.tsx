"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { PackageCheck, TrendingUp, AlertTriangle } from "lucide-react";
import { I18N, Language, MaterialItem } from "@/types/inventory";

interface MonthlyStat {
  month: string;
  consumedQty: number;
  costKRW: number;
  costUSD: number;
  exactCostKRW: number;
}

interface AnalyticsSummary {
  currentMonthCostKRW: number;
  currentMonthCostUSD: number;
  currentMonthConsumedQty: number;
  growthRate: number;
}

interface AnalyticsSectionProps {
  lang: Language;
  labId: string;
  inventory: Record<string, MaterialItem>;
  refreshTrigger?: number;
}

export default function AnalyticsSection({
  lang,
  labId,
  inventory,
  refreshTrigger = 0,
}: AnalyticsSectionProps) {
  const t = I18N[lang];

  const [monthlyData, setMonthlyData] = useState<MonthlyStat[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>({
    currentMonthCostKRW: 0,
    currentMonthCostUSD: 0,
    currentMonthConsumedQty: 0,
    growthRate: 0,
  });

  // DB 월별 통계 조회
  useEffect(() => {
    let isMounted = true;

    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/analytics?labId=${labId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted) {
          setMonthlyData(data.monthlyData || []);
          if (data.summary) setSummary(data.summary);
        }
      } catch (err) {
        console.error("월별 통계 조회 실패:", err);
      }
    }

    fetchAnalytics();
    return () => {
      isMounted = false;
    };
  }, [labId, refreshTrigger]);

  // 보유 자재 목록 기반 KPI 계산
  const items = Object.values(inventory);
  const totalValue = items.reduce(
    (acc, item) =>
      acc + item.stock * (lang === "ko" ? item.unitCostKRW : item.unitCostUSD),
    0
  );
  const lowStockCount = items.filter((item) => item.stock <= item.safeStock).length;

  // 재고 현황 바 차트 데이터 (상위 6개 품목)
  const stockChartData = items.slice(0, 6).map((item) => ({
    name: item.name,
    stock: item.stock,
    safeStock: item.safeStock,
  }));

  return (
    <>
      <div className="space-y-6">
        {/* KPI 요약 카드 */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{t.kpiStockValue}</span>
              <PackageCheck className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {t.currency}
              {totalValue.toLocaleString()}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {lang === "ko"
                ? `총 ${items.length}종 자재 보유 중`
                : `${items.length} active items in stock`}
            </p>
          </div>

          {/* 실제 DB 이번 달 출고 원가 연동 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{t.kpiMonthlyCost}</span>
              <TrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {t.currency}
              {(lang === "ko"
                ? summary.currentMonthCostKRW
                : summary.currentMonthCostUSD
              ).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {lang === "ko"
                ? `이번 달 총 ${summary.currentMonthConsumedQty}개 출고 (전월 대비 ${summary.growthRate > 0 ? `+${summary.growthRate}` : summary.growthRate}%)`
                : `${summary.currentMonthConsumedQty} units used (${summary.growthRate > 0 ? `+${summary.growthRate}` : summary.growthRate}% vs last mo)`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{t.kpiLowStock}</span>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              {lowStockCount} {t.unitCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {lang === "ko"
                ? "즉시 발주 권장 자재 확인 필요"
                : "Check materials requiring restock"}
            </p>
          </div>
        </section>

        {/* Recharts 그래프 */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-800">{t.chartCostTitle}</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey={lang === "ko" ? "costKRW" : "costUSD"}
                    name={lang === "ko" ? "원가 (만원)" : "Cost ($)"}
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-800">{t.chartMaterialTitle}</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="stock" name="현재 재고" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="safeStock" name="안전 재고" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
