// app/api/materials/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface BulkMaterialInput {
  barcode: string;
  name: string;
  nameEn?: string;
  category: string;
  stock: number;
  safeStock: number;
  unitCostKRW: number;
  unitCostUSD: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      labId,
      items,
      duplicateMode = "skip", // "skip" (중복 건너뛰기) | "upsert" (덮어쓰기)
    }: {
      labId: string;
      items: BulkMaterialInput[];
      duplicateMode?: "skip" | "upsert";
    } = body;

    if (!labId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "기공소 ID와 등록할 자재 목록이 필요합니다." },
        { status: 400 }
      );
    }

    // CSV 내부에 동일 바코드가 중복된 경우 마지막 행 기준으로 중복 제거
    const dedupedMap = new Map<string, BulkMaterialInput>();
    for (const item of items) {
      if (!item.barcode || !item.name) continue;
      dedupedMap.set(item.barcode.trim().toUpperCase(), item);
    }
    const cleanItems = Array.from(dedupedMap.values());

    // DB에 바코드 조회
    const existingMaterials = await prisma.material.findMany({
      where: {
        labId,
        barcode: { in: cleanItems.map((i) => i.barcode.trim().toUpperCase()) },
      },
      select: { barcode: true },
    });
    const existingSet = new Set(existingMaterials.map((m) => m.barcode));

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of cleanItems) {
        const normalizedBarcode = item.barcode.trim().toUpperCase();
        const exists = existingSet.has(normalizedBarcode);

        if (exists) {
          if (duplicateMode === "skip") {
            skippedCount++;
            continue;
          }

          // 덮어쓰기
          await tx.material.update({
            where: {
              labId_barcode: { labId, barcode: normalizedBarcode },
            },
            data: {
              name: item.name.trim(),
              nameEn: item.nameEn?.trim() || null,
              category: item.category.trim() || "기타",
              stock: Number(item.stock) || 0,
              safeStock: Number(item.safeStock) || 10,
              unitCostKRW: Number(item.unitCostKRW) || 0,
              unitCostUSD: Number(item.unitCostUSD) || 0,
              isActive: true,
            },
          });
          updatedCount++;
        } else {
          await tx.material.create({
            data: {
              labId,
              barcode: normalizedBarcode,
              name: item.name.trim(),
              nameEn: item.nameEn?.trim() || null,
              category: item.category.trim() || "기타",
              stock: Number(item.stock) || 0,
              safeStock: Number(item.safeStock) || 10,
              unitCostKRW: Number(item.unitCostKRW) || 0,
              unitCostUSD: Number(item.unitCostUSD) || 0,
              isActive: true,
            },
          });
          createdCount++;
        }
      }
    });

    return NextResponse.json(
      {
        message: "일괄 등록이 완료되었습니다.",
        summary: {
          total: cleanItems.length,
          created: createdCount,
          updated: updatedCount,
          skipped: skippedCount,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/materials/bulk] Error:", error);
    return NextResponse.json(
      { error: "자재 일괄 등록 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
