import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 거래처명 수정 (PATCH /api/clinics/[id])
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { labId, name } = body;

    if (!id || !name?.trim()) {
      return NextResponse.json(
        { error: "거래처 이름은 필수 입력 항목입니다." },
        { status: 400 }
      );
    }

    const normalizedName = name.trim();

    // 다른 활성 거래처와 이름이 중복되는지 확인
    const existing = await prisma.clinic.findFirst({
      where: {
        labId,
        name: normalizedName,
        isActive: true,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `이미 등록된 거래처입니다: ${normalizedName}` },
        { status: 409 }
      );
    }

    const updatedClinic = await prisma.clinic.update({
      where: { id },
      data: { name: normalizedName },
    });

    return NextResponse.json({
      message: "거래처 정보가 수정되었습니다.",
      clinic: {
        id: updatedClinic.id,
        name: updatedClinic.name,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/clinics/[id]] Error:", error);
    return NextResponse.json(
      { error: "거래처 수정 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 거래처 논리 삭제 (DELETE /api/clinics/[id])
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 거래처 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 기존 입·출고 내역 보존을 위해 물리 삭제 대신 비활성화(isActive: false) 처리
    await prisma.clinic.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: "거래처가 삭제되었습니다.",
    });
  } catch (error) {
    console.error("[DELETE /api/clinics/[id]] Error:", error);
    return NextResponse.json(
      { error: "거래처 삭제 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
