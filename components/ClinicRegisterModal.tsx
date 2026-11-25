"use client";

import React, { useState, useEffect } from "react";
import { X, Building2, Loader2, Trash2 } from "lucide-react";
import { Clinic, Language } from "@/types/inventory";

interface ClinicModalProps {
  isOpen: boolean;
  lang: Language;
  labId: string;
  initialName?: string;
  editingClinic?: Clinic | null;
  onClose: () => void;
  onSuccess: (savedClinic: Clinic, isEdit: boolean) => void;
  onDeleteSuccess?: (deletedClinicId: string) => void;
}

export default function ClinicModal({
  isOpen,
  lang,
  labId,
  initialName = "",
  editingClinic = null,
  onClose,
  onSuccess,
  onDeleteSuccess,
}: ClinicModalProps) {
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEditMode = Boolean(editingClinic);

  useEffect(() => {
    if (isOpen) {
      setName(editingClinic ? editingClinic.name : initialName);
      setErrorMsg(null);
    }
  }, [isOpen, editingClinic, initialName]);

  if (!isOpen) return null;

  // 등록 및 수정 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isDeleting) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const endpoint = isEditMode
        ? `/api/clinics/${editingClinic!.id}`
        : "/api/clinics";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          name: name.trim(),
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(
          data.error ||
            (isEditMode
              ? "거래처 수정에 실패했습니다."
              : "거래처 등록에 실패했습니다.")
        );
      }

      onSuccess(data.clinic, isEditMode);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제 처리
  const handleDelete = async () => {
    if (!editingClinic || !onDeleteSuccess || isSaving || isDeleting) return;

    const confirmMessage =
      lang === "ko"
        ? `'${editingClinic.name}' 거래처를 삭제하시겠습니까?\n(기존 입·출고 기록의 거래처명은 유지됩니다.)`
        : `Delete '${editingClinic.name}'?\n(Existing scan logs will keep the clinic name.)`;

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/clinics/${editingClinic.id}`, {
        method: "DELETE",
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(data.error || "거래처 삭제에 실패했습니다.");
      }

      onDeleteSuccess(editingClinic.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsDeleting(false);
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
                {isEditMode
                  ? lang === "ko"
                    ? "거래처 정보 수정"
                    : "Edit Dental Clinic"
                  : lang === "ko"
                  ? "신규 거래처(치과) 등록"
                  : "Register New Dental Clinic"}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditMode
                  ? lang === "ko"
                    ? "거래처명이나 담당자 호칭을 변경할 수 있습니다."
                    : "Update clinic name or contact title."
                  : lang === "ko"
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
              placeholder="예: OO 치과"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* 하단 버튼 */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            {/* 수정 모드일 때만 좌측에 삭제 버튼 표시 */}
            {isEditMode ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {lang === "ko" ? "거래처 삭제" : "Delete"}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditMode
                  ? lang === "ko"
                    ? "수정 완료"
                    : "Save Changes"
                  : lang === "ko"
                  ? "거래처 등록 완료"
                  : "Save Clinic"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
