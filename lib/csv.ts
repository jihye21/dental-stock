// lib/csv.ts

export interface ParsedMaterialRow {
  barcode: string;
  name: string;
  nameEn?: string;
  category: string;
  stock: number;
  safeStock: number;
  unitCostKRW: number;
  unitCostUSD: number;
}

/**
 * CSV 문자열을 파싱하여 자재 데이터 배열로 변환
 */
export function parseMaterialCsv(csvText: string): {
  validRows: ParsedMaterialRow[];
  errors: string[];
} {
  // BOM 제거 및 줄바꿈 정규화
  const cleanText = csvText.replace(/^\uFEFF/, "").trim();
  const lines = cleanText.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return {
      validRows: [],
      errors: ["데이터가 없습니다. 헤더와 최소 1개 이상의 행이 필요합니다."],
    };
  }

  const validRows: ParsedMaterialRow[] = [];
  const errors: string[] = [];

  // 헤더 제외하고 2번째 줄부터 순회
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const rowNum = i + 1;

    const barcode = (cols[0] || "").trim().toUpperCase();
    const name = (cols[1] || "").trim();
    const nameEn = (cols[2] || "").trim();
    const category = (cols[3] || "기타").trim();
    const stock = Number((cols[4] || "0").replace(/,/g, "").trim());
    const safeStock = Number((cols[5] || "10").replace(/,/g, "").trim());
    const unitCostKRW = Number((cols[6] || "0").replace(/,/g, "").trim());
    const unitCostUSD = Number((cols[7] || "0").replace(/,/g, "").trim());

    if (!barcode || !name) {
      errors.push(`${rowNum}행: 바코드와 국문 자재명은 필수입니다.`);
      continue;
    }

    if (isNaN(stock) || isNaN(safeStock) || isNaN(unitCostKRW) || isNaN(unitCostUSD)) {
      errors.push(`${rowNum}행 (${barcode}): 수량 및 단가는 숫자만 입력 가능합니다.`);
      continue;
    }

    validRows.push({
      barcode,
      name,
      nameEn: nameEn || undefined,
      category,
      stock: Math.max(0, Math.floor(stock)),
      safeStock: Math.max(0, Math.floor(safeStock)),
      unitCostKRW: Math.max(0, Math.floor(unitCostKRW)),
      unitCostUSD: Math.max(0, unitCostUSD),
    });
  }

  return { validRows, errors };
}

/**
 * CSV 열 분리
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * 엑셀 호환 CSV 파일로 다운로드
 */
export function downloadCsvFile(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number | null | undefined) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    "\uFEFF" +
    [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))].join(
      "\r\n"
    );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 자재 일괄 등록용 샘플 CSV 양식 다운로드
 */
export function downloadSampleMaterialCsv() {
  const headers = [
    "바코드*",
    "국문자재명*",
    "영문자재명",
    "카테고리",
    "현재재고",
    "안전재고",
    "매입단가_KRW",
    "매입단가_USD",
  ];
  const sampleRows = [
    ["ZIR-A2-98", "지르코니아 블록 A2 (98mm)", "Zirconia Block A2", "보철", 15, 5, 45000, 35.5],
    ["IMP-TI-45", "티타늄 환봉 4.5mm", "Titanium Rod 4.5mm", "임플란트", 30, 10, 18000, 14.0],
    ["CER-GLZ-10", "세라믹 글레이즈 파우더", "Ceramic Glaze Powder", "세라믹", 8, 3, 62000, 48.0],
  ];

  downloadCsvFile("dental-stock-sample-template.csv", headers, sampleRows);
}
