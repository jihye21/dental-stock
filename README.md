# Dental Stock - 치과 기공소 바코드 재고·출고 관리 시스템

> **바코드 스캐너 연동부터 창고 재고 실사(Audit), 다중 기기 동시성 제어까지 지원하는 현업 특화 ERP 대시보드**

* **배포 URL:** https://dental-stock-rosy.vercel.app/
* **기술 스택:** Next.js 16, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Recharts

---

## 1. 프로젝트 기획 배경
치과 기공소 현업에서는 지르코니아 블록, 임플란트 어버트먼트 등 고가 자재의 입·출고가 빈번하지만, 수기 장부나 엑셀 관리에 의존해 다음과 같은 문제가 발생합니다.

* **재고 오차 누적:** 출고 누락 및 바코드 중복 스캔으로 인한 전산 재고와 실물 재고 불일치
* **정산 지연:** 거래처별 출고 내역 어려움

이를 해결하기 위해 **모바일 카메라/USB 바코드 스캐너 즉시 인식, 엑셀 CSV 마이그레이션, 창고 실사 차이분 자동 보정** 기능을 갖춘 실시간 재고 관리 시스템을 구축했습니다.

---

## 2. 핵심 기능 요약
* **하이브리드 바코드 스캔 (`POST /api/scan`):** USB 바코드 리더기 및 모바일 후면 카메라(`CameraScanner`)를 통한 원클릭 입·출고 처리
* **창고 재고 실사 및 자동 보정 (`POST /api/materials/audit`):** 실물 재고 입력 시 전산 재고와의 차이분을 계산하여 `[실사조정]` 이력 생성 및 재고 동기화
* **엑셀(CSV) 일괄 등록 및 내보내기:** UTF-8 BOM 처리를 적용해 한글 깨짐 없는 재고 현황·입출고 이력 다운로드 및 대량 데이터 마이그레이션 지원
* **데이터 무결성 보호 (Soft Delete & Barcode Lock):** 이력이 존재하는 자재 삭제 시 `isActive` 플래그 기반 논리 삭제 처리 및 수정 시 바코드 키 값 잠금
* **다국어(KR/EN) 및 다중 통화(KRW/USD) 지원:** 해외 기공물 및 수입 자재 관리를 위한 실시간 언어·통화 전환

---

## 3. 기술적 트러블슈팅 & 엔지니어링

### Trouble 1. 동시 출고 요청 시 Race Condition으로 인한 마이너스 재고 방어
* **문제 상황:** 여러 작업자가 동시에 마지막 남은 재고를 출고 처리하거나, 바코드 스캐너가 0.1초 간격으로 동일 바코드를 연속 인식할 경우 재고가 음수(`-1`)가 되는 데이터 정합성 결함 위험이 존재했습니다.
* **해결 방법 (프론트엔드 + 백엔드 이중 방어):**
  1. **Client-side (`useBarcodeScan.ts`):** React 리렌더링 지연을 피하기 위해 `useRef` 기반의 **잠금**과 동일 바코드 **1.2초 쿨다운**을 적용해 물리적 중복 스캔을 1차 차단했습니다.
  2. **Server-side (`POST /api/scan`):** DB 트랜잭션 내에서 재고 검증과 차감을 원자적으로 처리하여 동시 요청 시 선행 요청만 승인하고 후행 요청을 차단하도록 설계했습니다.
* **검증 결과:**
  재고 1개 상태에서 2개의 프로세스로 동시 `OUT` 요청을 전송해 정합성을 검증했습니다.

  ```bash
    \$ curl -X POST http://localhost:3000/api/scan \
        -H "Content-Type: application/json" \
        -d '{"labId":"default-dental-lab","barcode":"AES-AS-A","type":"OUT","quantity":1}' & \
    curl -X POST http://localhost:3000/api/scan \
        -H "Content-Type: application/json" \
        -d '{"labId":"default-dental-lab","barcode":"AES-AS-A","type":"OUT","quantity":1}' & wait

    [1] 25818
    [2] 25819
    # [Process 1] 선행 요청 정상 승인 및 차감 완료 (stock: 1 -> 0)
    {"message":"바코드 처리가 완료되었습니다.","material":{"barcode":"AES-AS-A","name":"as","stock":0,...}}
    # [Process 2] 후행 요청 즉시 차단
    {"error":"재고가 부족합니다. ( as 현재 재고:  0개)"}
  ```

### Trouble 2. 동시 취소 요청 시 중복 재고 복구 및 500 롤백 비용 최적화
* **문제 상황:** 동일한 입·출고 내역(`DELETE /api/scan/[id]`)에 대해 중복 취소 요청이 동시에 유입될 경우, 선행 재고 복구 실행 후 후행 삭제 시점에서 레코드 부재로 `500 Internal Server Error`가 발생하며 불필요한 DB 쓰기 및 트랜잭션 롤백이 유발되었습니다.
* **해결 방법:**
  * **재고 복구보다 삭제(`deleteMany`)를 트랜잭션 최상단에 배치**했습니다. `deleteMany({ where: { id } })`의 반환값(`count === 1`)으로 삭제 권리를 먼저 획득한 **요청만 재고 복구 로직을 실행**하도록 순서를 역전시켜 불필요한 DB 쓰기·롤백 비용과 중복 복구를 방지했습니다.
* **병렬 테스트 검증 결과:**
  ```bash
    \(TARGET_ID=\)(curl -s ".../api/scan?labId=default-dental-lab" | jq -r '.recentLogs.id'); \
        curl -i -s -X DELETE ".../api/scan/\$TARGET_ID" & \
        curl -i -s -X DELETE ".../api/scan/\$TARGET_ID" & wait

    # [Process 1] HTTP/1.1 200 OK -> 삭제 권리 획득 및 재고 1회 정상 복구
    {"message":"입·출고 내역이 취소되고 재고가 복구되었습니다.","material":{"barcode":"AES-AS-A","stock":12, ...}}

    # [Process 2] HTTP/1.1 404 Not Found -> 중복 복구 및 500 서버 에러 원천 차단
    {"error":"이미 취소되었거나 존재하지 않는 내역입니다."}
  ```

### Trouble 3. 입·출고 취소 후 목록 공백 및 다중 탭 데이터 불일치 해결
* **문제 상황:** 최근 내역 10건이 표시된 상태에서 상단 내역을 취소(`DELETE /api/scan/[id]`)할 때, **다른 브라우저 탭에서 변경한 최신 재고·출고 통계가 반영되지 않는 문제**가 발생했습니다.
* **해결 방법 (SSOT 기반 상태 동기화):**
  1. 취소 직후 임의 부분 업데이트를 제거하고, `fetchDashboardData()`를 호출해 **서버의 최근 10건 및 전체 재고·거래처 통계를 SSOT로 동기화**했습니다.
  2. `window`의 `focus` 이벤트 리스너를 연동해 다중 탭 환경에서 탭 전환 시 별도 새로고침 없이 최신 상태를 자동 반영하도록 개선했습니다.

### Trouble 4. 단일 페이지 비대화 개선을 위한 Custom Hook 아키텍처 분리
* **문제 상황:** 초기 대시보드(`app/page.tsx`)에 서버 데이터 페칭, 스캔 잠금 `Ref`, CSV 데이터 변환, 모달 UI 상태가 혼재되어 유지보수성과 가독성이 떨어졌습니다.
* **해결 방법:**
  * `hooks/useDashboardData.ts`: 서버 상태 동기화, 탭 포커스 갱신, 취소 트랜잭션 전담
  * `hooks/useBarcodeScan.ts`: 바코드 정규화, `Ref` 동기 잠금 및 스캔 API 요청 전담
  * `hooks/useCsvExport.ts`: 재고/이력 데이터 포맷팅 및 CSV 다운로드 전담
  * 이를 통해 `app/page.tsx`는 순수 UI 렌더링과 모달 제어만 담당하도록 역할을 명확히 분리했습니다.

---

## 4. 프로젝트 폴더 구조
```text
dental-stock/
├── prisma/
│   └── schema.prisma                  # Material 모델 isActive(Soft Delete) 필드 포함
├── types/
│   └── inventory.ts                   # 데이터 타입 및 다국어(KR/EN) 사전
├── lib/
│   ├── prisma.ts                      # Prisma Client 싱글톤 인스턴스
│   ├── utils.ts                       # 공통 유틸리티 함수
│   └── csv.ts                         # 자재/거래처 CSV 파싱, 샘플 양식 및 엑셀(UTF-8 BOM) 다운로드 유틸
├── hooks/
│   ├── useDashboardData.ts            # 대시보드 서버 상태 동기화(SSOT), 탭 포커스 갱신, 취소 상태 복구 전담
│   ├── useBarcodeScan.ts              # 바코드 정규화, Ref 기반 잠금 및 1.2초 중복 스캔 쿨다운 제어
│   └── useCsvExport.ts                # 재고 현황 및 입·출고 이력 CSV 데이터 포맷팅 및 다운로드 상태 관리
├── components/
│   ├── Header.tsx                     # 상단 네비게이션, 통화 전환 + 엑셀 일괄등록/재고 실사 버튼
│   ├── BarcodeScannerBox.tsx          # 거래처 선택 + 바코드 스캔 + 빠른코드 토글 해제 + 바코드 관리 버튼
│   ├── CameraScanner.tsx              # 모바일 카메라 바코드 스캔
│   ├── ClinicRegisterModal.tsx        # 거래처 등록, 수정, 삭제 모달
│   ├── MaterialRegisterModal.tsx      # 바코드 등록, 일반 정보 수정, 논리 삭제 모달
│   ├── CsvBulkModal.tsx               # 자재 및 거래처 CSV 일괄 등록 통합 모달
│   ├── StockAuditModal.tsx            # 창고 실사 수량 입력 및 전산 재고 일괄 보정 모달
│   └── AnalyticsSection.tsx           # KPI 요약 카드 + Recharts 원가/재고 그래프
└── app/
    ├── api/
    │   ├── clinics/
    │   │   ├── route.ts               # 거래처 목록 조회 및 신규 등록
    │   │   ├── bulk/
    │   │   │   └── route.ts           # 거래처 CSV 일괄 등록 및 비활성 거래처 자동 복구
    │   │   └── [id]/
    │   │       └── route.ts           # 거래처 수정 및 삭제
    │   ├── materials/
    │   │   ├── route.ts               # 자재 목록 조회 및 신규 바코드 등록
    │   │   ├── bulk/
    │   │   │   └── route.ts           # 자재 CSV 일괄 등록 (중복 건너뛰기/덮어쓰기 지원)
    │   │   ├── audit/
    │   │   │   └── route.ts           # 실사 재고 수량 동기화 및 차이분 입·출고 조정 이력 생성(동시성 제어)
    │   │   └── [id]/
    │   │       └── route.ts           # 자재 일반 정보 수정(PATCH) 및 논리 삭제(DELETE)
    │   ├── export/
    │   │   └── route.ts               # 전체 재고 현황 및 전체 입·출고 이력 CSV 내보내기 조회
    │   └── scan/
    │       ├── route.ts               # 대시보드 조회(GET) 및 원자적 재고 차감·입고 처리(POST, Race Condition 방어)
    │       └── [id]/
    │           └── route.ts           # deleteMany 선점 기반 중복 취소 방어(DELETE) 및 재고 수량 자동 복구
    └── page.tsx                       # 메인 대시보드 UI 레이어 및 반응형 상단 알림·모달 제어
```
