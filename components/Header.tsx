"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, PackagePlus, FileSpreadsheet, Settings } from "lucide-react";
import { I18N, Language } from "@/types/inventory";

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  onOpenRegisterModal: () => void;
  onOpenBulkModal: () => void;
}

export default function Header({
  lang,
  onToggleLang,
  onOpenRegisterModal,
  onOpenBulkModal,
}: HeaderProps) {
  const t = I18N[lang];
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              {lang === "ko" ? "바코드 등록" : "Add Barcode"}
            </span>
            <span className="sm:hidden">
              {lang === "ko" ? "등록" : "Add"}
            </span>
          </button>

          {/* 2. 설정(더보기) 드롭다운 메뉴 */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label={lang === "ko" ? "설정 및 도구" : "Settings & Tools"}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition active:scale-95 sm:h-10 sm:w-10 ${isMenuOpen
                  ? "border-slate-300 bg-slate-100 text-slate-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5">
                {/* 데이터 관리 섹션 */}
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">
                  {lang === "ko" ? "데이터 관리" : "Data Management"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenBulkModal();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    {lang === "ko" ? "엑셀(CSV) 일괄 등록" : "Bulk Import (CSV)"}
                  </span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                {/* 환경 설정 섹션 */}
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">
                  {lang === "ko" ? "언어 및 통화" : "Language & Currency"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onToggleLang();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>{lang === "ko" ? "표시 언어/통화" : "Display Locale"}</span>
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {lang === "ko" ? "KR ₩" : "EN $"}
                  </span>
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
    </header>
  );
}
