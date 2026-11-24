"use client";

import React from "react";
import { Globe } from "lucide-react";
import { I18N, Language } from "@/types/inventory";

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
}

export default function Header({ lang, onToggleLang }: HeaderProps) {
  const t = I18N[lang];

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">{t.title}</h1>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
        </div>

        <button
          onClick={onToggleLang}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          <Globe className="h-4 w-4 text-blue-600" />
          <span>{lang === "ko" ? "KR (₩ KRW)" : "Global ($ USD)"}</span>
        </button>
      </div>
    </header>
  );
}
