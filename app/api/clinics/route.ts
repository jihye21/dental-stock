import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { labId, name, contactName, phone } = body;

    if (!labId || !name?.trim()) {
      return NextResponse.json(
        { error: "거래처 이름은 필수 입력 항목입니다." },
        { status: 400 }
      );
    }

    const normalizedName = name.trim();

    // 동일 기공소 내 중복 치과명 확인
    const existing = await prisma.clinic.findFirst({
      where: {
        labId,
        name: normalizedName,
        isActive: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `이미 등록된 거래처입니다: ${normalizedName}` },
        { status: 409 }
      );
    }

    // 신규 치과 생성
    const newClinic = await prisma.clinic.create({
      data: {
        labId,
        name: normalizedName,
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        message: "신규 거래처가 등록되었습니다.",
        clinic: {
          id: newClinic.id,
          name: newClinic.name,
          count: 0, // 방금 등록된 거래처 초기 출고 건수
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/clinics] Error:", error);
    return NextResponse.json(
      { error: "거래처 등록 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
