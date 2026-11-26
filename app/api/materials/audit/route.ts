// app/api/materials/audit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface AuditItemInput {
  materialId: string;
  actualStock: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      labId,
      items,
      reason = "정기 재고 실사",
    }: {
      labId: string;
      items: AuditItemInput[];
      reason?: string;
    } = body;

    if (!labId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "기공소 ID와 실사 조정할 품목 데이터가 필요합니다." },
        { status: 400 }
      );
    }

    const materialIds = items.map((i) => i.materialId);

    // DB에서 최신 재고 상태 조회
    const dbMaterials = await prisma.material.findMany({
      where: {
        labId,
        id: { in: materialIds },
        isActive: true,
      },
    });

    const materialMap = new Map(dbMaterials.map((m) => [m.id, m]));

    // 실제 차이가 발생한 품목만 필터링
    const adjustments: {
      material: (typeof dbMaterials);
      actualStock: number;
      diff: number;
    }[] = [];

    for (const item of items) {
      const mat = materialMap.get(item.materialId);
      if (!mat) continue;

      const parsedActual = Math.max(0, Math.floor(Number(item.actualStock)));
      if (isNaN(parsedActual)) continue;

      const diff = parsedActual - mat.stock;
      if (diff !== 0) {
        adjustments.push({
          material: mat,
          actualStock: parsedActual,
          diff,
        });
      }
    }

    if (adjustments.length === 0) {
      return NextResponse.json(
        { error: "변경된 재고 수량이 없습니다." },
        { status: 400 }
      );
    }

    const cleanReason = reason.trim() || "정기 재고 실사";

    // 트랜잭션으로 재고 업데이트 및 조정 이력 일괄 생성
    await prisma.$transaction(async (tx) => {
      for (const adj of adjustments) {
        const isIncrease = adj.diff > 0;
        const absDiff = Math.abs(adj.diff);

        // 1. 자재 현재 재고 실사 수량으로 동기화
        await tx.material.update({
          where: { id: adj.material.id },
          data: { stock: adj.actualStock },
        });

        // 2. 조정 내역을 InventoryTransaction에 기록
        await tx.inventoryTransaction.create({
          data: {
            labId,
            type: isIncrease ? TransactionType.IN : TransactionType.OUT,
            quantity: absDiff,
            unitCostKRW: adj.material.unitCostKRW,
            unitCostUSD: adj.material.unitCostUSD,
            materialId: adj.material.id,
            clinicId: null, // 치과 납품이 아닌 내부 재고 조정이므로 null
            memo: `[실사조정] ${cleanReason} (${adj.material.stock} → ${adj.actualStock})`,
          },
        });
      }
    });

    return NextResponse.json(
      {
        message: "실사 재고 조정이 완료되었습니다.",
        adjustedCount: adjustments.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/materials/audit] Error:", error);
    return NextResponse.json(
      { error: "실사 재고 조정 처리 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
