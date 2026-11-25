import "dotenv/config";
import { PrismaClient, Currency, TransactionType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const LAB_ID = "default-dental-lab";

  console.log("치과기공소 초기 데이터 시드 시작...");

  // 1. 기본 기공소 생성
  const lab = await prisma.lab.upsert({
    where: { id: LAB_ID },
    update: {},
    create: {
      id: LAB_ID,
      name: "서울디지털치과기공소",
      country: "KR",
      currency: Currency.KRW,
    },
  });
  console.log(`✅ 기공소 준비 완료: ${lab.name} (${lab.id})`);

  // 2. 기본 거래처(치과) 6곳 생성
  const clinicsData = [
    { id: "clinic-seoul-top", name: "서울탑치과" },
    { id: "clinic-yonsei-miso", name: "연세미소치과" },
    { id: "clinic-gangnam-plant", name: "강남플란트치과" },
    { id: "clinic-barun-ortho", name: "바른이교정치과" },
    { id: "clinic-whiteline", name: "화이트라인치과" },
    { id: "clinic-thewell", name: "더웰치과병원" },
  ];

  for (const clinic of clinicsData) {
    await prisma.clinic.upsert({
      where: { id: clinic.id },
      update: { name: clinic.name },
      create: {
        id: clinic.id,
        labId: LAB_ID,
        name: clinic.name,
      },
    });
  }
  console.log(`✅ 기본 거래처(치과) ${clinicsData.length}곳 등록 완료`);

  // 3. 기본 기공 자재 4종 생성
  const materialsData = [
    {
      barcode: "ZIR-A2-98",
      name: "지르코니아 블록 A2 (98mm)",
      nameEn: "Zirconia Block A2 (98mm)",
      category: "보철",
      stock: 24,
      safeStock: 10,
      unitCostKRW: 65000,
      unitCostUSD: 48,
    },
    {
      barcode: "TI-PRE-10",
      name: "티타늄 환봉 프리밀 10mm",
      nameEn: "Titanium Premilled Blank 10mm",
      category: "임플란트",
      stock: 8, // 안전재고(15) 미달 테스트용
      safeStock: 15,
      unitCostKRW: 22000,
      unitCostUSD: 16,
    },
    {
      barcode: "LITH-HT-B1",
      name: "리튬디실리케이트 인곳 B1",
      nameEn: "Lithium Disilicate Ingot B1",
      category: "세라믹",
      stock: 45,
      safeStock: 20,
      unitCostKRW: 18000,
      unitCostUSD: 13,
    },
    {
      barcode: "RES-3D-1KG",
      name: "3D프린터 모델 레진 (1kg)",
      nameEn: "3D Printer Model Resin (1kg)",
      category: "디지털",
      stock: 12,
      safeStock: 5,
      unitCostKRW: 85000,
      unitCostUSD: 62,
    },
  ];

  const createdMaterials: Record<string, { id: string; unitCostKRW: number; unitCostUSD: number }> = {};

  for (const mat of materialsData) {
    const saved = await prisma.material.upsert({
      where: {
        labId_barcode: {
          labId: LAB_ID,
          barcode: mat.barcode,
        },
      },
      update: {},
      create: {
        labId: LAB_ID,
        ...mat,
      },
    });
    createdMaterials[mat.barcode] = saved;
  }
  console.log(`✅ 기본 기공 자재 ${materialsData.length}종 등록 완료`);

  // 4. 최근 7일 출고 빈도 TOP UI 확인용 초기 출고 이력 생성 (이력이 0건일 때만 실행)
  const existingTxCount = await prisma.inventoryTransaction.count({
    where: { labId: LAB_ID },
  });

  if (existingTxCount === 0) {
    const sampleOutCounts = [
      { clinicId: "clinic-seoul-top", count: 6, barcode: "ZIR-A2-98" },
      { clinicId: "clinic-yonsei-miso", count: 5, barcode: "TI-PRE-10" },
      { clinicId: "clinic-gangnam-plant", count: 4, barcode: "ZIR-A2-98" },
      { clinicId: "clinic-barun-ortho", count: 3, barcode: "LITH-HT-B1" },
      { clinicId: "clinic-whiteline", count: 2, barcode: "RES-3D-1KG" },
      { clinicId: "clinic-thewell", count: 1, barcode: "LITH-HT-B1" },
    ];

    const txRecords = [];
    for (const item of sampleOutCounts) {
      const mat = createdMaterials[item.barcode];
      for (let i = 0; i < item.count; i++) {
        txRecords.push({
          labId: LAB_ID,
          type: TransactionType.OUT,
          quantity: 1,
          unitCostKRW: mat.unitCostKRW,
          unitCostUSD: mat.unitCostUSD,
          materialId: mat.id,
          clinicId: item.clinicId,
          memo: "초기 시드 샘플 출고 데이터",
        });
      }
    }

    await prisma.inventoryTransaction.createMany({
      data: txRecords,
    });
    console.log(`✅ 최근 7일 출고 빈도 집계용 샘플 이력 ${txRecords.length}건 생성 완료`);
  }

  console.log("🎉 모든 초기 데이터 세팅이 완료되었습니다!");
}

main()
  .catch((e) => {
    console.error("❌ 시드 실행 중 오류 발생:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
