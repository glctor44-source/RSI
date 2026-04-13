import { NextRequest, NextResponse } from "next/server";
import { runRsiBacktest } from "@/lib/backtest";
import { normalizeTicker } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const ticker = normalizeTicker(request.nextUrl.searchParams.get("ticker") ?? "");
  const startDateISO = request.nextUrl.searchParams.get("startDate") ?? "";
  const endDateISO = request.nextUrl.searchParams.get("endDate") ?? "";
  const entryRsi = parseNumber(request.nextUrl.searchParams.get("entryRsi"), 30);
  const exitRsi = parseNumber(request.nextUrl.searchParams.get("exitRsi"), 55);
  const initialCapital = parseNumber(request.nextUrl.searchParams.get("initialCapital"), 10000);

  if (!ticker) {
    return NextResponse.json({ error: "ticker가 비어 있습니다." }, { status: 400 });
  }

  if (!startDateISO || !endDateISO) {
    return NextResponse.json({ error: "startDate와 endDate가 필요합니다." }, { status: 400 });
  }

  if (entryRsi < 1 || entryRsi > 99 || exitRsi < 1 || exitRsi > 99 || entryRsi >= exitRsi) {
    return NextResponse.json({ error: "RSI 조건을 확인해주세요. 진입 RSI는 청산 RSI보다 작아야 합니다." }, { status: 400 });
  }

  if (initialCapital <= 0) {
    return NextResponse.json({ error: "initialCapital은 0보다 커야 합니다." }, { status: 400 });
  }

  try {
    const result = await runRsiBacktest({
      ticker,
      startDateISO,
      endDateISO,
      entryRsi,
      exitRsi,
      initialCapital
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "백테스트 실행 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
