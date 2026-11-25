"use client";

import React from "react";
import { Globe, PackagePlus } from "lucide-react";
import { I18N, Language } from "@/types/inventory";

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  onOpenRegisterModal: () => void;
}

export default function Header({
  lang,
  onToggleLang,
  onOpenRegisterModal,
}: HeaderProps) {
  const t = I18N[lang];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xs sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        {/* 로고 & 타이틀 */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="truncate">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {t.title}
            </h1>
            <p className="hidden truncate text-xs text-slate-500 sm:block">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* 우측 액션 버튼 (모바일 터치 영역 최적화) */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-xs transition active:scale-95 hover:bg-slate-800 sm:h-10 sm:px-3.5 sm:text-sm"
          >
            <PackagePlus className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="hidden sm:inline">
              {lang === "ko" ? "초기 바코드 등록" : "Add Barcode"}
            </span>
            <span className="sm:hidden">
              {lang === "ko" ? "자재등록" : "Add"}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleLang}
            className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition active:scale-95 hover:bg-slate-100 sm:h-10 sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Globe className="h-3.5 w-3.5 shrink-0 text-blue-600 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">
              {lang === "ko" ? "KR (₩ KRW)" : "Global ($ USD)"}
            </span>
            <span className="sm:hidden">{lang === "ko" ? "KR₩" : "EN$"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
