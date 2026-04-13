# ETF RSI Dashboard + Backtest Lab

Next.js 기반 ETF RSI 대시보드이자 간단한 RSI 전략 백테스트 도구입니다.

## Features

- 관심 ETF watchlist 관리
- Yahoo Finance 기반 현재가, RSI(14), 1일 변화율, 1년 수익률 조회
- 권장 RSI 입력 및 괴리율 정렬
- Import / Export JSON
- RSI 진입/청산 규칙 기반 백테스트
  - 예시: RSI 30 이하 매수, RSI 55 이상 매도
  - 총 수익률, 연환산 수익률, Buy & Hold 비교, MDD, 승률, 거래 로그 제공

## Run

```bash
npm install
npm run dev
```

## Deploy (Vercel)

### 1) GitHub 연결 배포 (추천)

1. Vercel에서 `Add New Project` 선택
2. 이 저장소 import
3. Framework Preset이 `Next.js`인지 확인
4. Deploy 실행

### 2) CLI 배포

```bash
npm i -g vercel
vercel
vercel --prod
```

### 3) 배포 후 점검

- `/` 페이지 로드 확인
- `/api/market-data?tickers=TQQQ,SOXL,UPRO` 호출 시 JSON 응답 확인
- `/api/backtest?ticker=TQQQ&startDate=2025-01-01&endDate=2026-01-01&entryRsi=30&exitRsi=55&initialCapital=10000` 호출 시 JSON 응답 확인
- 첫 접속 시 기본 watchlist(25개) 자동 로드 확인
- Import/Export JSON 동작 확인
- 백테스트 패널에서 ticker/기간/RSI/초기자금 변경 후 결과 갱신 확인

## Import JSON format

```json
{
  "version": 1,
  "exportedAtISO": "2026-02-03T00:00:00.000Z",
  "watchItems": [
    { "ticker": "TQQQ", "sector": "Unassigned", "recommendedRsi": 60 }
  ]
}
```
