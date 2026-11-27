import { useState, useRef, useCallback } from "react";
import { TransactionMode } from "@/types/inventory";

interface UseBarcodeScanProps {
  labId: string;
  onSuccess: (data: any, mode: TransactionMode, clinicId: string) => void;
  onUnregistered: (barcode: string) => void;
  onToast: (toast: { type: "success" | "error"; message: string }) => void;
}

export function useBarcodeScan({
  labId,
  onSuccess,
  onUnregistered,
  onToast,
}: UseBarcodeScanProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isScanningLockRef = useRef(false);
  const lastScanRef = useRef<{ code: string; mode: TransactionMode | ""; time: number }>({
    code: "",
    mode: "",
    time: 0,
  });

  const handleProcessScan = useCallback(
    async (code: string, mode: TransactionMode, clinicId: string) => {
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) return;

      // 1. [동기 잠금] 중복 호출 차단
      if (isScanningLockRef.current || isSubmitting) return;

      // 2. [1.2초 쿨다운] 동일 바코드 연속 스캔 차단
      const now = Date.now();
      if (
        lastScanRef.current.code === normalizedCode &&
        lastScanRef.current.mode === mode &&
        now - lastScanRef.current.time < 1200
      ) {
        return;
      }

      isScanningLockRef.current = true;
      lastScanRef.current = { code: normalizedCode, mode, time: now };
      setIsSubmitting(true);

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labId,
            barcode: normalizedCode,
            type: mode,
            clinicId: mode === "OUT" ? clinicId : undefined,
            quantity: 1,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 404 && data.code === "UNREGISTERED_BARCODE") {
            onUnregistered(data.barcode || normalizedCode);
            return;
          }

          onToast({
            type: "error",
            message: `⚠️ ${data.error || "처리 중 오류가 발생했습니다."}`,
          });
          return;
        }

        onSuccess(data, mode, clinicId);
      } catch {
        onToast({
          type: "error",
          message: "⚠️ 네트워크 오류로 바코드 처리에 실패했습니다.",
        });
      } finally {
        isScanningLockRef.current = false;
        setIsSubmitting(false);
      }
    },
    [labId, isSubmitting, onSuccess, onUnregistered, onToast]
  );

  return {
    isSubmitting,
    handleProcessScan,
  };
}
