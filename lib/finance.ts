import { createRequire } from "node:module";
import { MarketRow, WatchItem } from "@/lib/types";
import { calculateRsiWilder, round2 } from "@/lib/rsi";

// Use CJS entry to avoid bundling ESM test-only modules on Vercel build.
const require = createRequire(import.meta.url);
const yahooFinance = require("yahoo-finance2").default;

const HISTORICAL_DAYS = 420;

type QuotePoint = {
  close?: number;
  volume?: number;
  date?: Date;
};

function find1yClose(points: QuotePoint[]): number | null {
  if (points.length === 0) {
    return null;
  }

  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  let candidate: QuotePoint | null = null;
  let minDiff = Number.POSITIVE_INFINITY;

  for (const point of points) {
    if (typeof point.close !== "number" || !point.date) {
      continue;
    }
    const diff = Math.abs(point.date.getTime() - oneYearAgo);
    if (diff < minDiff) {
      minDiff = diff;
      candidate = point;
    }
  }

  return typeof candidate?.close === "number" ? candidate.close : null;
}

export async function buildMarketRow(watchItem: WatchItem): Promise<MarketRow> {
  const base: MarketRow = {
    ...watchItem,
    rsi14: null,
    rsiDeviationPct: null,
    price: null,
    changePct1d: null,
    price1yAgo: null,
    return1yPct: null,
    volume: null,
    lastUpdatedISO: new Date().toISOString(),
    status: "ERROR"
  };

  try {
    const period1 = new Date(Date.now() - HISTORICAL_DAYS * 24 * 60 * 60 * 1000);

    const [quote, historical] = await Promise.all([
      yahooFinance.quote(watchItem.ticker),
      yahooFinance.historical(watchItem.ticker, { period1, interval: "1d" })
    ]);

    const points = (historical || []) as QuotePoint[];
    const closes = points.map((p) => p.close).filter((v): v is number => typeof v === "number");

    const rsi14 = closes.length >= 200 ? calculateRsiWilder(closes, 14) : null;
    const latestClose = closes.at(-1) ?? null;
    const currentPrice = typeof quote.regularMarketPrice === "number" ? quote.regularMarketPrice : latestClose;
    const prevClose = typeof quote.regularMarketPreviousClose === "number" ? quote.regularMarketPreviousClose : null;

    const changePct1d =
      currentPrice && prevClose && prevClose !== 0 ? round2(((currentPrice - prevClose) / prevClose) * 100) : null;

    const price1yAgo = find1yClose(points);
    const return1yPct =
      currentPrice && price1yAgo && price1yAgo !== 0 ? round2(((currentPrice - price1yAgo) / price1yAgo) * 100) : null;

    const deviation =
      typeof rsi14 === "number" && typeof watchItem.recommendedRsi === "number" && watchItem.recommendedRsi > 0
        ? round2(((rsi14 - watchItem.recommendedRsi) / watchItem.recommendedRsi) * 100)
        : null;

    const hasPartialGap = rsi14 === null || currentPrice === null || price1yAgo === null;

    return {
      ...base,
      rsi14: typeof rsi14 === "number" ? round2(rsi14) : null,
      rsiDeviationPct: deviation,
      price: typeof currentPrice === "number" ? round2(currentPrice) : null,
      changePct1d,
      price1yAgo: typeof price1yAgo === "number" ? round2(price1yAgo) : null,
      return1yPct,
      volume: typeof quote.regularMarketVolume === "number" ? quote.regularMarketVolume : points.at(-1)?.volume ?? null,
      status: hasPartialGap ? "PARTIAL" : "OK"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ...base,
      error: message,
      status: "ERROR"
    };
  }
}
