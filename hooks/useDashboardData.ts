import { useState, useCallback, useEffect } from "react";
import { Clinic, Language, MaterialItem, ScanLog, TransactionMode } from "@/types/inventory";

interface UseDashboardDataProps {
  labId: string;
  lang: Language;
  onToast: (toast: { type: "success" | "error"; message: string }) => void;
}

export function useDashboardData({ labId, lang, onToast }: UseDashboardDataProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cancellingLogId, setCancellingLogId] = useState<string | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [inventory, setInventory] = useState<Record<string, MaterialItem>>({});
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);

  // 대시보드 데이터 전체 조회
  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan?labId=${labId}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "데이터 조회에 실패했습니다.");
      }

      setClinics(data.frequentClinics || []);

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
      onToast({
        type: "error",
        message: err.message || "서버와 연결할 수 없습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [labId, lang, onToast]);

  // 초기 로드 및 탭 포커스 복귀 시 자동 동기화
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleFocus = () => fetchDashboardData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchDashboardData]);

  // 입·출고 내역 취소 및 전체 데이터 재동기화
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
      const res = await fetch(`/api/scan/${log.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "취소 처리에 실패했습니다.");
      }

      await fetchDashboardData();

      onToast({
        type: "success",
        message:
          lang === "ko"
            ? `${actionLabel}가 취소되고 재고가 복구되었습니다.`
            : "Transaction cancelled and stock restored.",
      });
    } catch (err: any) {
      onToast({
        type: "error",
        message: err.message || "취소 처리 중 오류가 발생했습니다.",
      });
    } finally {
      setCancellingLogId(null);
    }
  };

  // 스캔 성공 시 로컬 상태 반영
  const applyScanResult = useCallback(
    (data: any, mode: TransactionMode, clinicId: string) => {
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

      onToast({
        type: "success",
        message: `✅ [${mode === "OUT" ? "출고" : "입고"}] ${newLog.itemName} → ${clinicName} (잔여: ${updatedMat.stock}개)`,
      });
    },
    [lang, onToast]
  );

  // 자재 및 거래처 CRUD 후 상태 동기화
  const handleMaterialRegistered = (newMat: any) => {
    setInventory((prev) => ({
      ...prev,
      [newMat.barcode]: {
        id: newMat.id, 
        barcode: newMat.barcode,
        name: lang === "en" && newMat.nameEn ? newMat.nameEn : newMat.name,
        nameEn: newMat.nameEn || "",
        category: newMat.category,
        stock: newMat.stock,
        safeStock: newMat.safeStock,
        unitCostKRW: newMat.unitCostKRW,
        unitCostUSD: newMat.unitCostUSD,
      },
    }));

    onToast({
      type: "success",
      message: `✅ 신규 자재 등록 완료: [${newMat.barcode}] ${newMat.name}`,
    });
  };

  const handleClinicSaved = (savedClinic: Clinic, isEdit: boolean, onSelect?: (id: string) => void) => {
    if (isEdit) {
      setClinics((prev) =>
        prev.map((c) => (c.id === savedClinic.id ? savedClinic : c))
      );
      onToast({ type: "success", message: `✅ 거래처 정보가 수정되었습니다.` });
    } else {
      setClinics((prev) => [savedClinic, ...prev]);
      onSelect?.(savedClinic.id);
      onToast({ type: "success", message: `✅ 새 거래처가 등록되었습니다.` });
    }
  };

  const handleClinicDeleted = useCallback(
    (deletedId: string, onAfterDelete?: () => void) => {
        setClinics((prev) => prev.filter((c) => c.id !== deletedId));
        onAfterDelete?.();
        onToast({
        type: "success",
        message: "✅ 거래처가 삭제되었습니다.",
        });
    },
    [onToast]
    );

  return {
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
  };
}
