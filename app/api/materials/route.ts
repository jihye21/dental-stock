import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      labId,
      barcode,
      name,
      nameEn,
      category,
      stock = 0,
      safeStock = 10,
      unitCostKRW = 0,
      unitCostUSD = 0,
    } = body;

    if (!labId || !barcode || !name || !category) {
      return NextResponse.json(
        { error: "바코드, 자재명, 카테고리는 필수 입력 항목입니다." },
        { status: 400 }
      );
    }

    const normalizedBarcode = barcode.trim().toUpperCase();

    // 중복 바코드 확인
    const existing = await prisma.material.findUnique({
      where: {
        labId_barcode: {
          labId,
          barcode: normalizedBarcode,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `이미 등록된 바코드입니다: ${normalizedBarcode}` },
        { status: 409 }
      );
    }

    // 신규 자재 생성
    const newMaterial = await prisma.material.create({
      data: {
        labId,
        barcode: normalizedBarcode,
        name: name.trim(),
        nameEn: nameEn?.trim() || null,
        category,
        stock: Number(stock),
        safeStock: Number(safeStock),
        unitCostKRW: Number(unitCostKRW),
        unitCostUSD: Number(unitCostUSD),
      },
    });

    return NextResponse.json(
      {
        message: "신규 자재가 등록되었습니다.",
        material: newMaterial,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/materials] Error:", error);
    return NextResponse.json(
      { error: "자재 등록 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
