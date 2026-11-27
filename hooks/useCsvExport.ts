import { useState, useCallback } from "react";
import { Language } from "@/types/inventory";
import { downloadCsvFile } from "@/lib/csv";

interface UseCsvExportProps {
  labId: string;
  lang: Language;
  onToast: (toast: { type: "success" | "error"; message: string }) => void;
}

export function useCsvExport({ labId, lang, onToast }: UseCsvExportProps) {
  const [isExporting, setIsExporting] = useState<"materials" | "transactions" | null>(null);

  const handleExportCsv = useCallback(
    async (target: "materials" | "transactions") => {
      if (isExporting) return;
      setIsExporting(target);

      try {
        const res = await fetch(`/api/export?labId=${labId}&target=${target}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "다운로드 데이터를 불러오지 못했습니다.");
        }

        const todayStr = new Date().toISOString().slice(0, 10);

        if (target === "materials") {
          const headers = [
            "바코드", "국문자재명", "영문자재명", "카테고리",
            "현재재고", "안전재고", "매입단가_KRW", "매입단가_USD", "재고자산가치_KRW",
          ];
          const rows = (data.materials || []).map((m: any) => [
            m.barcode, m.name, m.nameEn || "", m.category,
            m.stock, m.safeStock, m.unitCostKRW, m.unitCostUSD, m.stock * m.unitCostKRW,
          ]);
          downloadCsvFile(`dental-stock-inventory-${todayStr}.csv`, headers, rows);
        } else {
          const headers = [
            "일시", "구분", "바코드", "카테고리", "자재명",
            "거래처(치과)", "수량", "단가_KRW", "합계금액_KRW", "단가_USD", "합계금액_USD", "메모",
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

        onToast({
          type: "success",
          message:
            lang === "ko"
              ? "엑셀(CSV) 파일 다운로드가 완료되었습니다."
              : "CSV file downloaded successfully.",
        });
      } catch (err: any) {
        onToast({
          type: "error",
          message: err.message || "다운로드 중 오류가 발생했습니다.",
        });
      } finally {
        setIsExporting(null);
      }
    },
    [labId, lang, isExporting, onToast]
  );

  return {
    isExporting,
    handleExportCsv,
  };
}
