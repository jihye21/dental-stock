// app/api/clinics/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface BulkClinicInput {
  name: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      labId,
      items,
    }: {
      labId: string;
      items: BulkClinicInput[];
    } = body;

    if (!labId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "기공소 ID와 등록할 거래처 목록이 필요합니다." },
        { status: 400 }
      );
    }

    // CSV 내부 중복 제거
    const uniqueNamesMap = new Map<string, string>();
    for (const item of items) {
      const trimmed = item.name?.trim();
      if (!trimmed) continue;
      uniqueNamesMap.set(trimmed.toLowerCase(), trimmed);
    }
    const cleanNames = Array.from(uniqueNamesMap.values());

    // DB에 이미 등록된 거래처 전체 조회
    const existingClinics = await prisma.clinic.findMany({
      where: { labId },
      select: { id: true, name: true, isActive: true },
    });

    const existingMap = new Map(
      existingClinics.map((c) => [c.name.trim().toLowerCase(), c])
    );

    let createdCount = 0;
    let restoredCount = 0;
    let skippedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const name of cleanNames) {
        const key = name.toLowerCase();
        const existing = existingMap.get(key);

        if (existing) {
          if (!existing.isActive) {
            // 과거에 삭제되었던 거래처라면 다시 활성화
            await tx.clinic.update({
              where: { id: existing.id },
              data: { isActive: true, name },
            });
            restoredCount++;
          } else {
            // 이미 활성 상태인 거래처는 중복 방지 건너뛰기
            skippedCount++;
          }
        } else {
          await tx.clinic.create({
            data: {
              labId,
              name,
              isActive: true,
            },
          });
          createdCount++;
        }
      }
    });

    return NextResponse.json(
      {
        message: "거래처 일괄 등록이 완료되었습니다.",
        summary: {
          total: cleanNames.length,
          created: createdCount,
          restored: restoredCount,
          skipped: skippedCount,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/clinics/bulk] Error:", error);
    return NextResponse.json(
      { error: "거래처 일괄 등록 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
