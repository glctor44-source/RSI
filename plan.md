# ETF RSI Dashboard – plan.md

## 1. 프로젝트 개요

본 프로젝트는 사용자가 선택한 ETF 티커의 기술적 지표(RSI 중심)를 한 화면에서 확인하고,  
각 티커별로 **사용자가 직접 입력한 권장 RSI 기준 대비 괴리 정도**를 통해  
과매도/과열 상태를 빠르게 탐색할 수 있는 웹 기반 대시보드를 구축하는 것을 목표로 한다.

- 대상 자산: ETF (추후 개별 주식 확장 가능)
- 핵심 지표: RSI(14, 일봉)
- 배포 환경: Vercel
- 구현 방식: Next.js + 서버 API 기반 데이터 조회
- 투자 판단 고지: 본 서비스는 정보 제공용이며 투자 자문을 제공하지 않는다.

---

## 2. 핵심 투자 전략 설계

### 2.1 RSI 사용 목적

- RSI는 **절대적인 매매 신호**가 아니라 관찰 우선순위 필터링 도구로 사용한다.
- 본 서비스의 목적:
  - RSI가 낮고
  - 사용자가 생각하는 관심 구간(Recommended RSI)에 근접하거나 이탈한 ETF를
  - 빠르게 시각적으로 식별하는 것

### 2.2 RSI 기준값 정책 (중요)

- **Recommended RSI는 ticker별로 사용자가 직접 입력**
- 전역 기본값은 두지 않는다 (미입력 상태는 `N/A`)
- 예시:
  - QQQ -> 30
  - TLT -> 35
  - GLD -> 40
- 서비스는 RSI 기준값을 판단하지 않고, **계산과 비교만 수행**

### 2.3 괴리율(Deviation) 정의

```text
RSI Deviation (%) = ((RSI(14) - Recommended RSI) / Recommended RSI) * 100
```

- 음수: 권장 RSI보다 낮음 (관심 구간 접근)
- 양수: 권장 RSI보다 높음
- 소수점 2자리 표시
- Recommended RSI가 0 또는 비어 있으면 `N/A`

---

## 3. 표시 데이터 명세 (Table Columns)

| 컬럼명 | 설명 |
|------|------|
| Sector | 사용자가 지정하는 섹터 (자유 입력 또는 프리셋) |
| Ticker | ETF 티커 (예: QQQ, SPY) |
| RSI(14) | 일봉 기준 RSI(14) |
| Recommended RSI | 사용자 수기 입력 값 |
| RSI Deviation % | 권장 RSI 대비 괴리율 |
| Current Price | 현재가 (또는 최근 종가) |
| Change % (1D) | 전일 대비 등락률 |
| Price 1Y Ago | 1년 전 가장 가까운 거래일 종가 |
| Return % (1Y) | 1년 전 대비 수익률 |
| Volume | 최근 거래량 |
| Last Updated | 데이터 마지막 갱신 시각 |
| Status | `OK` / `PARTIAL` / `ERROR` |

---

## 4. 사용자 인터랙션 (UX)

### 4.1 Ticker 관리

- 사용자는 티커를 자유롭게 추가/삭제/수정 가능
- 입력 방식:
  - 단일 입력: QQQ
  - 다중 입력: QQQ, SPY, TLT
- 입력 검증:
  - 영문 대문자 + 숫자 + `-`만 허용
  - 중복 티커 자동 제거
  - 최대 50개(초기 제한)

### 4.2 권장 RSI 입력 방식

- 각 행(Row)에 **Recommended RSI 숫자 입력 필드** 제공
- 입력 즉시:
  - 괴리율 재계산
  - 테이블 UI 업데이트
- Recommended RSI는 서버 계산에 영향을 주지 않으며 **프론트 계산값**
- 허용 범위: 1~99, 범위 밖 값은 저장하지 않고 에러 메시지 표시

### 4.3 정렬 & 필터

- 기본 정렬: RSI 오름차순
- 정렬 옵션:
  - RSI
  - RSI Deviation %
  - 1Y Return
  - 1D Change
- 필터:
  - 섹터별 필터
  - RSI 구간 필터
    - RSI < Recommended RSI
    - Recommended RSI <= RSI <= 70
    - RSI > 70
  - 데이터 상태 필터 (`OK`, `ERROR`)

### 4.4 갱신 UX

- 수동 갱신 버튼 제공 (`새로고침`)
- 자동 갱신 주기(기본 15분) 옵션 제공 여부는 MVP 결정 항목으로 분리
- 마지막 갱신 시각 표기(사용자 로컬 타임존 기준)

### 4.5 초기 기본 Watchlist (Owner 제공)

- 첫 실행 시 LocalStorage에 사용자 데이터가 없으면 아래 기본 목록으로 초기화
- 이후에는 사용자가 편집한 목록을 우선 사용

```ts
const DEFAULT_WATCHLIST: WatchItem[] = [
  { ticker: "BNKU", sector: "Unassigned", recommendedRsi: 35 },
  { ticker: "BULZ", sector: "Unassigned", recommendedRsi: 65 },
  { ticker: "CURE", sector: "Unassigned", recommendedRsi: 45 },
  { ticker: "DFEN", sector: "Unassigned", recommendedRsi: 40 },
  { ticker: "DPST", sector: "Unassigned", recommendedRsi: 35 },
  { ticker: "DRN", sector: "Unassigned", recommendedRsi: 40 },
  { ticker: "DUSL", sector: "Unassigned", recommendedRsi: 40 },
  { ticker: "FAS", sector: "Unassigned", recommendedRsi: 45 },
  { ticker: "FNGU", sector: "Unassigned", recommendedRsi: 55 },
  { ticker: "HIBL", sector: "Unassigned", recommendedRsi: 55 },
  { ticker: "LABU", sector: "Unassigned", recommendedRsi: 45 },
  { ticker: "MIDU", sector: "Unassigned", recommendedRsi: 45 },
  { ticker: "NAIL", sector: "Unassigned", recommendedRsi: 50 },
  { ticker: "PILL", sector: "Unassigned", recommendedRsi: 45 },
  { ticker: "RETL", sector: "Unassigned", recommendedRsi: 50 },
  { ticker: "SOXL", sector: "Unassigned", recommendedRsi: 65 },
  { ticker: "TECL", sector: "Unassigned", recommendedRsi: 60 },
  { ticker: "TNA", sector: "Unassigned", recommendedRsi: 50 },
  { ticker: "TPOR", sector: "Unassigned", recommendedRsi: 40 },
  { ticker: "TQQQ", sector: "Unassigned", recommendedRsi: 60 },
  { ticker: "UDOW", sector: "Unassigned", recommendedRsi: 50 },
  { ticker: "UPRO", sector: "Unassigned", recommendedRsi: 55 },
  { ticker: "UTSL", sector: "Unassigned", recommendedRsi: 35 },
  { ticker: "WANT", sector: "Unassigned", recommendedRsi: 55 },
  { ticker: "WEBL", sector: "Unassigned", recommendedRsi: 60 },
];
```

---

## 5. 데이터 소스 및 계산 기준

### 5.1 데이터 소스

- Yahoo Finance (via `yahoo-finance2`)
- 서버(Route Handler)에서 데이터 조회
- 서버에서 간단 캐싱 처리(권장: 5~15분)

### 5.2 RSI 계산 기준

- Timeframe: 일봉 (Daily)
- Period: RSI(14)
- 계산 방식: **Wilder’s RSI (표준 방식)**
- 최소 데이터:
  - RSI 계산 안정화용 최소 200 거래일 종가
  - 부족 시 `N/A` + 에러 메시지

### 5.3 가격 및 수익률 계산

- Current Price:
  - `regularMarketPrice` 우선
  - 없을 경우 마지막 종가 사용
- 1년 전 가격:
  - 오늘 날짜 기준 -365일
  - 가장 가까운 거래일 종가 사용
- 수익률:

```text
Return 1Y (%) = ((Current Price - Price 1Y Ago) / Price 1Y Ago) * 100
```

---

## 6. API 설계 (명세 추가)

### 6.1 Endpoint

- `GET /api/market-data?tickers=QQQ,SPY,TLT`

### 6.2 응답 형태

```ts
type MarketDataResponse = {
  requestedAtISO: string;
  rows: MarketRow[];
  errors: { ticker: string; message: string }[];
};
```

### 6.3 제약/보호

- 요청당 ticker 최대 50개
- 입력 ticker 정규화(공백 제거, 대문자 변환)
- 실패 row는 개별 `error` 필드로 반환, 전체 500 최소화

---

## 7. 기술 스택

### 7.1 Frontend

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (Table, Input, Button, Badge)

### 7.2 Backend

- Next.js Route Handler (`/api/market-data`)
- `yahoo-finance2`
- 다중 ticker batch 조회 지원

### 7.3 상태 관리 & 저장

- 저장 위치:
  - LocalStorage (MVP)
- 저장 대상:
  - ticker 목록
  - sector
  - recommended RSI
  - 마지막 정렬/필터 상태(선택)
- Export / Import:
  - JSON 형태 저장/복원

---

## 8. 데이터 모델

```ts
type WatchItem = {
  ticker: string;
  sector: string;
  recommendedRsi: number | null;
};

type MarketRow = WatchItem & {
  rsi14: number | null;
  rsiDeviationPct: number | null;
  price: number | null;
  changePct1d: number | null;
  price1yAgo: number | null;
  return1yPct: number | null;
  volume: number | null;
  lastUpdatedISO: string;
  status: "OK" | "PARTIAL" | "ERROR";
  error?: string;
};
```

---

## 9. 에러 처리 원칙

- 특정 ticker 데이터 실패 시:
  - 전체 앱 중단 X
  - 해당 row만 에러 표시 O
- 계산 불가 시 `N/A` 표시
- 네트워크 오류 시 사용자에게 재시도 버튼 제공
- 레이트리밋/외부 API 장애 시:
  - 사용자 메시지: "데이터 소스 응답 지연. 잠시 후 다시 시도해주세요."

---

## 10. MVP 범위 정의

### 포함

- RSI(14) 계산 (Wilder)
- ticker별 권장 RSI 수기 입력
- 괴리율 계산
- LocalStorage 저장
- 테이블 정렬/필터
- API 입력 검증 및 부분 실패 처리
- Vercel 배포

### 제외 (추후 확장)

- 로그인
- 알림 기능
- 자동 RSI 기준 추천
- 멀티 타임프레임
- 백테스트/전략 시뮬레이터

---

## 11. 개발 완료 기준 (Acceptance Criteria)

- 사용자가 ticker + 권장 RSI를 입력하면 즉시 계산 반영
- 새로고침 후에도 목록 유지
- RSI/괴리율/수익률 계산 정확
- 실패 티커가 있어도 나머지 row 정상 표시
- Vercel 환경에서 빌드/실행 오류 없이 동작
- 코드 구조가 추후 기능 확장 가능하도록 모듈화

---

## 12. 테스트 기준 (추가)

- 단위 테스트:
  - RSI 계산 함수 (샘플 데이터 고정)
  - 괴리율 계산 함수 (0/Null 엣지 케이스)
  - ticker 파서/정규화
- 통합 테스트:
  - `/api/market-data` 성공/부분실패 시나리오
- E2E(선택):
  - 티커 추가 -> 조회 -> 새로고침 후 복원

---

## 13. Vercel 배포 기준 (추가)

### 13.1 런타임/환경

- 기본: Node.js Runtime 사용 (Edge 아님)
- Vercel 프로젝트 Framework Preset: Next.js
- 환경변수:
  - `NEXT_PUBLIC_APP_NAME` (선택)
  - 외부 API 키 필요 시 `VERCEL_ENV`별로 분리 설정

### 13.2 캐시/성능 권장

- Route Handler에서 서버 캐싱 적용
- 응답 헤더 예시: `s-maxage=300, stale-while-revalidate=300`
- 불필요한 과호출 방지를 위해 클라이언트 자동 폴링 최소화

### 13.3 운영 점검 체크리스트

- 배포 후 `/api/market-data` 200 응답 확인
- 주요 티커(예: QQQ/SPY/TLT) 데이터 정상 표시 확인
- LocalStorage 저장/복원 확인
- 모바일 뷰(최소 390px) 테이블 가독성 확인

---

## 14. 내가 결정해야 할 항목 (Owner Decision List)

1. 자동 갱신 주기 채택 여부
   - 옵션 A: 수동 갱신만 (단순/안정)
   - 옵션 B: 15분 자동 갱신 + 수동 갱신
2. 섹터 입력 방식
   - 옵션 A: 자유 텍스트만
   - 옵션 B: 프리셋 + 자유 입력 혼합
3. 티커 최대 개수
   - 옵션 A: 30개 (가볍고 빠름)
   - 옵션 B: 50개 (유연성 높음)
4. 모바일 UI 방식
   - 옵션 A: 가로 스크롤 테이블
   - 옵션 B: 카드형 전환 + 테이블 병행
5. 테스트 범위
   - 옵션 A: 핵심 유닛 테스트만
   - 옵션 B: 유닛 + API 통합 테스트까지

---

## 15. Codex 구현 지침

- 위 기획을 충족하는 실행 가능한 프로젝트 구조 제공
- RSI 계산은 Wilder 방식으로 직접 구현
- 서버에서 batch 조회, 프론트는 가볍게 유지
- 에러는 row 단위로 격리 처리
