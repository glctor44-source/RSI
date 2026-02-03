# ETF RSI Dashboard

Next.js 기반 ETF RSI 대시보드입니다.

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
- 첫 접속 시 기본 watchlist(25개) 자동 로드 확인
- Import/Export JSON 동작 확인

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
