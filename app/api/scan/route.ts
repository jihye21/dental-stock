import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Material, TransactionType } from "@prisma/client";

// [GET] 최근 7일 출고 빈도 TOP 8 거래처 + 전체 자재 재고 + 최근 스캔 로그 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // 추후 Supabase Auth 세션의 user.labId로 대체
    const labId = searchParams.get("labId");

    if (!labId) {
      return NextResponse.json(
        { error: "기공소 식별자(labId)가 필요합니다." },
        { status: 400 }
      );
    }

    // 1. 최근 7일 기준일 계산
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 2. 최근 7일간 출고(OUT) 건수 기준 상위 8개 거래처 집계
    const topClinicGroups = await prisma.inventoryTransaction.groupBy({
      by: ["clinicId"],
      where: {
        labId,
        type: TransactionType.OUT,
        clinicId: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 8,
    });

    // 집계된 clinicId 목록으로 치과 상세 정보 매핑
    const topClinicIds = topClinicGroups
      .map((g) => g.clinicId)
      .filter((id): id is string => id !== null);

    const clinicDetails = await prisma.clinic.findMany({
      where: { id: { in: topClinicIds }, isActive: true },
      select: { id: true, name: true },
    });

    const clinicNameMap = new Map(clinicDetails.map((c) => [c.id, c.name]));

    const frequentClinics = topClinicGroups
      .filter((group) => group.clinicId && clinicNameMap.has(group.clinicId))
      .map((group) => ({
        id: group.clinicId!,
        name: clinicNameMap.get(group.clinicId!)!,
        count: group._count.id,
      }));

    // 3. 보유 자재 목록 및 최근 입출고 로그 10건 병렬 조회
    const [materials, recentLogs] = await Promise.all([
      prisma.material.findMany({
        where: { labId, isActive: true, },
        orderBy: { name: "asc" },
      }),
      prisma.inventoryTransaction.findMany({
        where: { labId },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          material: { select: { barcode: true, name: true, nameEn: true } },
          clinic: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      frequentClinics,
      materials,
      recentLogs,
    });
  } catch (error) {
    console.error("[GET /api/scan] Error:", error);
    return NextResponse.json(
      { error: "대시보드 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// [POST] 입·출고 처리 및 재고 수량 동기화
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      labId,
      barcode,
      type,
      clinicId,
      quantity = 1,
      memo,
    }: {
      labId: string;
      barcode: string;
      type: "IN" | "OUT";
      clinicId?: string;
      quantity?: number;
      memo?: string;
    } = body;

    // 1. 필수 값 검증
    if (!labId || !barcode || !type) {
      return NextResponse.json(
        { error: "필수 파라미터(labId, barcode, type)가 누락되었습니다." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "수량은 1 이상의 정수여야 합니다." },
        { status: 400 }
      );
    }

    const normalizedBarcode = barcode.trim().toUpperCase();

    // 2. Prisma 트랜잭션 실행
    const result = await prisma.$transaction(async (tx) => {
      let updatedRows: Material[];

      // 조건부 잠금, 재고 증감, 갱신 데이터 반환 
      if (type === "OUT") {
        updatedRows = await tx.$queryRaw<Material[]>`
          UPDATE "Material"
          SET
            "stock" = "stock" - ${quantity},
            "updatedAt" = NOW()
          WHERE "labId" = ${labId}
            AND "barcode" = ${normalizedBarcode}
            AND "isActive" = true
            AND "stock" >= ${quantity}
          REURNING *
        `;
      } else {
        updatedRows = await tx.$queryRaw<Material[]>`
          UPDATE "Material"
          SET
            "stock" = "stock" + ${quantity},
            "updatedAt" = NOW()
          WHERE "labId" = ${labId}
            AND "barcode" = ${normalizedBarcode}
            AND "isActive" = true
          RETURNING *
        `;
      }

      let updatedMaterial = updatedRows[0];

      // 업데이트된 행이 없는 경우 원인 판별
      if(!updatedMaterial) {
        const existing = await tx.material.findUnique({
          where: {
            labId_barcode: {
              labId,
              barcode: normalizedBarcode,
            },
          },
          select: { name: true, stock: true, isActive: true },
        });

        if (!existing || !existing.isActive) {
          throw new Error(`UNREGISTERED_BARCODE: ${normalizedBarcode}`);
        }

        throw new Error(
          `INSUFFICIENT_STOCK: ${existing.name}: ${existing.stock}`
        );
      }

      // 2-3. 입·출고 이력 및 당시 원가 스냅샷 기록
      const transaction = await tx.inventoryTransaction.create({
        data: {
          labId,
          type: type as TransactionType,
          quantity,
          unitCostKRW: updatedMaterial.unitCostKRW,
          unitCostUSD: updatedMaterial.unitCostUSD,
          materialId: updatedMaterial.id,
          clinicId: type === "OUT" ? clinicId || null : null,
          memo: memo || null,
        },
        include: {
          material: { select: { barcode: true, name: true, nameEn: true } },
          clinic: { select: { name: true } },
        },
      });

      return { updatedMaterial, transaction };
    });

    return NextResponse.json(
      {
        message: "바코드 처리가 완료되었습니다.",
        material: result.updatedMaterial,
        transaction: result.transaction,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "";

    // 예외 처리
    if (errMsg.startsWith("UNREGISTERED_BARCODE:")) {
      const barcode = errMsg.split(":")[1];
      return NextResponse.json(
        {   
            code: "UNREGISTERED_BARCODE",
            barcode,
            error: `미등록 바코드입니다: ${barcode}`,
        },
        { status: 404 }
      );
    }

    if (errMsg.startsWith("INSUFFICIENT_STOCK:")) {
      const [, name, currentStock] = errMsg.split(":");
      return NextResponse.json(
        { error: `재고가 부족합니다. (${name} 현재 재고: ${currentStock}개)` },
        { status: 409 }
      );
    }

    console.error("[POST /api/scan] Error:", error);
    return NextResponse.json(
      { error: "바코드 스캔 처리 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
