import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      // 취소할 입·출고 기록 조회
      const transaction = await tx.inventoryTransaction.findUnique({
        where: { id },
        include: { material: true },
      });

      if (!transaction) {
        throw new Error("NOT_FOUND");
      }

      // 입고 취소 시 현재 재고가 마이너스가 되는지 검증
      if (
        transaction.type === "IN" &&
        transaction.material.stock < transaction.quantity
      ) {
        throw new Error(
          `INSUFFICIENT_STOCK:${transaction.material.name}:${transaction.material.stock}`
        );
      }

      // 동시에 2개 요청이 들어와도 DB 행 락에 의해 단 1개만 count === 1을 반환
      const deleted = await tx.inventoryTransaction.deleteMany({
        where: { id },
      });

      if (deleted.count === 0) {
        throw new Error("NOT_FOUND");
      }

      // 단일 요청만 자재 재고 원복 실행
      const stockRestoreDelta =
        transaction.type === "OUT"
          ? transaction.quantity
          : -transaction.quantity;

      const updatedMaterial = await tx.material.update({
        where: { id: transaction.materialId },
        data: {
          stock: { increment: stockRestoreDelta },
        },
      });

      return { updatedMaterial, deletedTransaction: transaction };
    });

    return NextResponse.json({
      message: "입·출고 내역이 취소되고 재고가 복구되었습니다.",
      material: result.updatedMaterial,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "";

    if (errMsg === "NOT_FOUND") {
      return NextResponse.json(
        { error: "이미 취소되었거나 존재하지 않는 내역입니다." },
        { status: 404 }
      );
    }

    if (errMsg.startsWith("INSUFFICIENT_STOCK:")) {
      const [, name, currentStock] = errMsg.split(":");
      return NextResponse.json(
        {
          error: `현재 재고(${currentStock}개)가 부족하여 '${name}' 입고 내역을 취소할 수 없습니다.`,
        },
        { status: 409 }
      );
    }

    console.error("[DELETE /api/scan/[id]] Error:", error);
    return NextResponse.json(
      { error: "내역 취소 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
