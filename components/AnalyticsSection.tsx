"use client";

import React from "react";
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

interface AnalyticsSectionProps {
  lang: Language;
  inventory: Record<string, MaterialItem>;
  monthlyData: { month: string; costKRW: number; costUSD: number; usage: number }[];
}

export default function AnalyticsSection({
  lang,
  inventory,
  monthlyData,
}: AnalyticsSectionProps) {
  const t = I18N[lang];

  const totalValue = Object.values(inventory).reduce(
    (acc, item) => acc + item.stock * (lang === "ko" ? item.unitCostKRW : item.unitCostUSD),
    0
  );
  const lowStockCount = Object.values(inventory).filter((i) => i.stock < i.safeStock).length;

  const stockChartData = Object.entries(inventory).map(([sku, item]) => ({
    name: item.name.split(" ")[0],
    sku,
    stock: item.stock,
    safeStock: item.safeStock,
  }));

  return (
    <>
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
          <p className="mt-1 text-xs font-medium text-emerald-600">+4.2% 전월 대비</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{t.kpiMonthlyCost}</span>
            <TrendingUp className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {lang === "ko" ? "₩5,900,000" : "$4,350"}
          </p>
          <p className="mt-1 text-xs text-slate-500">기공 매출 대비 원가율 24.8%</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{t.kpiLowStock}</span>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {lowStockCount} {t.unitCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">즉시 발주 권장 자재 확인 필요</p>
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
    </>
  );
}
