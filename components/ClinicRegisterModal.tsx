"use client";

import React, { useState, useEffect } from "react";
import { X, Building2, Loader2 } from "lucide-react";
import { Clinic, Language } from "@/types/inventory";

interface ClinicRegisterModalProps {
  isOpen: boolean;
  lang: Language;
  labId: string;
  initialName?: string;
  onClose: () => void;
  onSuccess: (createdClinic: Clinic) => void;
}

export default function ClinicRegisterModal({
  isOpen,
  lang,
  labId,
  initialName = "",
  onClose,
  onSuccess,
}: ClinicRegisterModalProps) {
  const [name, setName] = useState(initialName);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setContactName("");
      setPhone("");
      setErrorMsg(null);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          name,
          contactName,
          phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "거래처 등록에 실패했습니다.");
      }

      onSuccess(data.clinic);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {lang === "ko" ? "신규 거래처(치과) 등록" : "Register New Dental Clinic"}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === "ko"
                  ? "등록 즉시 출고 거래처로 자동 선택됩니다."
                  : "Automatically selected for immediate dispatch."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 rounded-lg bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-600">
            {errorMsg}
          </div>
        )}

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              치과 / 병원명 *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 여의도서울치과"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                담당 원장 / 실장명
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="예: 김원장 / 이실장"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                연락처
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="02-1234-5678"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ko" ? "거래처 등록 완료" : "Save Clinic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
