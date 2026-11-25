import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStackFrameFile } from "next/dist/next-devtools/shared/stack-frame";

//바코드 상세 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      nameEn,
      category,
      stock,
      safeStock,
      unitCostKRW,
      unitCostUSD,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "자재명은 필수 입력 항목입니다." },
        { status: 400 }
      );
    }

    const updatedMaterial = await prisma.material.update({
      where: { id },
      data: {
        name: name.trim(),
        nameEn: nameEn?.trim() || null,
        category,
        stock: Number(stock) || 0,
        safeStock: Number(safeStock) || 0,
        unitCostKRW: Number(unitCostKRW) || 0,
        unitCostUSD: Number(unitCostUSD) || 0,
      },
    });

    return NextResponse.json({ material: updatedMaterial });
  } catch (error) {
    console.error("[PATCH /api/materials/[id]] Error:", error);
    return NextResponse.json(
      { error: "자재 정보 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 바코드 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.material.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/materials/[id]] Error:", error);
    return NextResponse.json(
      { error: "바코드 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
