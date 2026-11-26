// app/api/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const labId = searchParams.get("labId");
    const target = searchParams.get("target"); // "materials" | "transactions"

    if (!labId) {
      return NextResponse.json({ error: "labId가 필요합니다." }, { status: 400 });
    }

    if (target === "materials") {
      const materials = await prisma.material.findMany({
        where: { labId, isActive: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      return NextResponse.json({ materials });
    }

    if (target === "transactions") {
      const transactions = await prisma.inventoryTransaction.findMany({
        where: { labId },
        orderBy: { createdAt: "desc" },
        include: {
          material: { select: { barcode: true, name: true, nameEn: true, category: true } },
          clinic: { select: { name: true } },
        },
      });
      return NextResponse.json({ transactions });
    }

    return NextResponse.json({ error: "유효하지 않은 다운로드 대상입니다." }, { status: 400 });
  } catch (error) {
    console.error("[GET /api/export] Error:", error);
    return NextResponse.json(
      { error: "엑셀 내보내기 데이터를 조회하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
