import { NextRequest, NextResponse } from "next/server";
import { buildMarketRow } from "@/lib/finance";
import { WatchItem } from "@/lib/types";
import { parseTickerInput } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = parseTickerInput(raw);

  if (tickers.length === 0) {
    return NextResponse.json(
      {
        requestedAtISO: new Date().toISOString(),
        rows: [],
        errors: [{ ticker: "*", message: "tickers 쿼리 파라미터가 비어 있습니다." }]
      },
      { status: 400 }
    );
  }

  const requestedAtISO = new Date().toISOString();

  const watchItems: WatchItem[] = tickers.map((ticker) => ({
    ticker,
    sector: "Unassigned",
    recommendedRsi: null
  }));

  const rows = await Promise.all(watchItems.map((item) => buildMarketRow(item)));
  const errors = rows
    .filter((row) => row.error)
    .map((row) => ({ ticker: row.ticker, message: row.error as string }));

  const response = NextResponse.json({ requestedAtISO, rows, errors });
  response.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=300");

  return response;
}
