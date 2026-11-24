"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { CameraOff, RefreshCw, Volume2 } from "lucide-react";

interface CameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function CameraScanner({
  onScanSuccess,
  onClose,
}: CameraScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({
    code: "",
    time: 0,
  });

  // 스캔 성공 시 짧은 비프음 재생 (무선 바코드 스캐너와 동일한 현장감 제공)
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // 높은 도(C6)
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // 브라우저 정책으로 오디오 차단 시 무시
    }
  };

  useEffect(() => {
    const elementId = "dental-html5-qrcode-reader";
    const html5QrCode = new Html5Qrcode(elementId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
      ],
      verbose: false,
    });

    scannerRef.current = html5QrCode;

    const startCamera = async () => {
      try {
        setIsStarting(true);
        setError(null);

        await html5QrCode.start(
          { facingMode: "environment" }, // 모바일 후면 카메라 우선 사용
          {
            fps: 10,
            qrbox: { width: 260, height: 150 }, // 1D 바코드 & QR 모두 인식하기 좋은 직사각형 박스
            aspectRatio: 1.777778,
          },
          (decodedText) => {
            const now = Date.now();
            const normalized = decodedText.trim().toUpperCase();

            // 동일 바코드 1.5초 이내 연속 중복 인식 방지
            if (
              lastScannedRef.current.code === normalized &&
              now - lastScannedRef.current.time < 1500
            ) {
              return;
            }

            lastScannedRef.current = { code: normalized, time: now };
            playBeep();
            onScanSuccess(normalized);
          },
          () => {
            // 프레임당 인식 실패 콜백은 빈번하므로 무시
          }
        );
      } catch (err: unknown) {
        console.error("Camera start error:", err);
        setError(
          "카메라에 접근할 수 없습니다. 브라우저의 카메라 권한을 허용했는지, HTTPS(또는 localhost) 환경인지 확인해 주세요."
        );
      } finally {
        setIsStarting(false);
      }
    };

    startCamera();

    // 컴포넌트 언마운트 시 카메라 스트림 안전 종료
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-300 bg-slate-900 text-white shadow-inner">
      {/* 상단 안내 바 */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-emerald-400">
          <Volume2 className="h-4 w-4" />
          <span className="font-medium">
            사각형 가이드 안에 자재 바코드 또는 QR코드를 비춰주세요
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700"
        >
          <CameraOff className="h-3.5 w-3.5" />
          <span>카메라 닫기</span>
        </button>
      </div>

      {/* 실제 카메라 뷰포트 */}
      <div className="relative flex min-h-[260px] flex-col items-center justify-center bg-black">
        {isStarting && !error && (
          <div className="absolute z-10 flex items-center gap-2 text-sm text-slate-300">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
            <span>후면 카메라를 연결하는 중입니다...</span>
          </div>
        )}

        {error ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-rose-400">{error}</p>
          </div>
        ) : (
          <div id="dental-html5-qrcode-reader" className="w-full max-w-md" />
        )}
      </div>
    </div>
  );
}
