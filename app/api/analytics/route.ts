import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const labId = searchParams.get("labId");

    if (!labId) {
      return NextResponse.json(
        { error: "기공소 식별자(labId)가 필요합니다." },
        { status: 400 }
      );
    }

    // 1. 최근 6개월 시작일 계산 (5개월 전 1일 00:00:00)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // 2. 최근 6개월간 출고(OUT) 기록 전체 조회
    const outTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        labId,
        type: TransactionType.OUT,
        createdAt: { gte: startDate },
      },
      select: {
        quantity: true,
        unitCostKRW: true,
        unitCostUSD: true,
        createdAt: true,
      },
    });

    // 3. 최근 6개월 기본 뼈대 생성 (출고 내역이 0건인 달도 0으로 차트에 표시)
    const monthlyMap = new Map<
      string,
      {
        month: string;
        consumedQty: number;
        rawCostKRW: number;
        rawCostUSD: number;
      }
    >();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${d.getMonth() + 1}월`;
      monthlyMap.set(key, {
        month: label,
        consumedQty: 0,
        rawCostKRW: 0,
        rawCostUSD: 0,
      });
    }

    // 4. 트랜잭션 순회하며 월별 소모 수량 및 총 원가(단가 * 수량) 누적
    for (const tx of outTransactions) {
      const d = new Date(tx.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key);

      if (entry) {
        entry.consumedQty += tx.quantity;
        entry.rawCostKRW += tx.unitCostKRW * tx.quantity;
        entry.rawCostUSD += tx.unitCostUSD * tx.quantity;
      }
    }

    // 5. Recharts 포맷 변환 (원화는 차트 축에 맞춰 '만원' 단위로 변환)
    const monthlyData = Array.from(monthlyMap.values()).map((item) => ({
      month: item.month,
      consumedQty: item.consumedQty,
      costKRW: Math.round(item.rawCostKRW / 10000), // 만원 단위
      costUSD: Number(item.rawCostUSD.toFixed(2)),
      exactCostKRW: item.rawCostKRW, // 툴팁/카드용 정확한 원 단위 금액
    }));

    // 6. 이번 달(마지막 요소) 및 전월(뒤에서 두 번째 요소) KPI 요약 계산
    const currentMonth = monthlyData[monthlyData.length - 1];
    const prevMonth = monthlyData[monthlyData.length - 2];

    let growthRate = 0;
    if (prevMonth && prevMonth.exactCostKRW > 0) {
      growthRate = Number(
        (
          ((currentMonth.exactCostKRW - prevMonth.exactCostKRW) /
            prevMonth.exactCostKRW) *
          100
        ).toFixed(1)
      );
    }

    return NextResponse.json({
      monthlyData,
      summary: {
        currentMonthCostKRW: currentMonth?.exactCostKRW ?? 0,
        currentMonthCostUSD: currentMonth?.costUSD ?? 0,
        currentMonthConsumedQty: currentMonth?.consumedQty ?? 0,
        growthRate,
      },
    });
  } catch (error) {
    console.error("[GET /api/analytics] Error:", error);
    return NextResponse.json(
      { error: "월별 통계 데이터를 집계하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
