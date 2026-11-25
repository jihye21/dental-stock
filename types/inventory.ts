export type Language = "ko" | "en";
export type TransactionMode = "OUT" | "IN";

export interface Clinic {
    id: string;
    name: string;
    count: number;
}

export interface MaterialItem {
    id?: string;          
    barcode?: string;     
    name: string;
    nameEn?: string;      
    category: string;
    stock: number;
    safeStock: number;
    unitCostKRW: number;
    unitCostUSD: number;
}

export interface ScanLog {
    id: string;
    time: string;
    type: TransactionMode;
    barcode: string;
    itemName: string;
    clinicName: string;
    costKRW: number;
    costUSD: number;
}

export const I18N = {
    ko: {
        title: "Dental-Stock",
        subtitle: "치과기공소 특화 바코드 재고·원가 관리",
        modeIn: "입고",
        modeOut: "출고",
        quickClinicsTitle: "최근 TOP 거래처",
        searchClinicPlaceholder: "전체 거래처 검색...",
        barcodePlaceholder: "바코드 스캐너로 스캔하거나 품목 코드를 입력하세요",
        cameraScanBtn: "카메라 스캔",
        submitBtn: "처리 완료",
        kpiStockValue: "총 재고 자산 가치",
        kpiMonthlyCost: "이번 달 자재 원가",
        kpiLowStock: "안전재고 미달 품목",
        chartCostTitle: "월별 자재 소모량 및 원가 추이",
        chartMaterialTitle: "주요 기공 자재별 재고 현황",
        recentLogsTitle: "바코드 입출고 내역",
        currency: "₩",
        unitCount: "개",
    },
    
    en: {
        title: "Dental-Stock",
        subtitle: "Dental-Stock Barcode Inventory & Cost System",
        modeIn: "Stock IN",
        modeOut: "Stock OUT",
        quickClinicsTitle: "Top Frequent Clinics",
        searchClinicPlaceholder: "Search all clinics...",
        barcodePlaceholder: "Scan barcode or enter SKU",
        cameraScanBtn: "Camera Scan",
        submitBtn: "Process",
        kpiStockValue: "Total Inventory Value",
        kpiMonthlyCost: "Monthly Material Cost",
        kpiLowStock: "Low Stock Alerts",
        chartCostTitle: "Monthly Material Consumption & Cost",
        chartMaterialTitle: "Inventory Level by Key Materials",
        recentLogsTitle: "Barcode Scan Logs",
        currency: "$",
        unitCount: "ea",
  },
} as const;