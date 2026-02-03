import { MarketRow, WatchItem } from "@/lib/types";
import { calculateRsiWilder, round2 } from "@/lib/rsi";

type YahooChartResponse = {
  chart?: {
    error?: { description?: string } | null;
    result?: Array<{
      timestamp?: number[];
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type QuotePoint = {
  date: Date;
  close: number;
  volume: number | null;
};

async function fetchHistory(ticker: string): Promise<{
  points: QuotePoint[];
  regularMarketPrice: number | null;
  previousClose: number | null;
}> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", "2y");
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0"
    },
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`Yahoo 요청 실패 (${response.status})`);
  }

  const json = (await response.json()) as YahooChartResponse;
  const result = json.chart?.result?.[0];
  const apiError = json.chart?.error?.description;

  if (apiError) {
    throw new Error(apiError);
  }
  if (!result) {
    throw new Error("차트 데이터를 찾지 못했습니다.");
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];

  const points: QuotePoint[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (typeof close !== "number" || Number.isNaN(close)) {
      continue;
    }

    points.push({
      date: new Date(timestamps[i] * 1000),
      close,
      volume: typeof volumes[i] === "number" ? volumes[i] : null
    });
  }

  return {
    points,
    regularMarketPrice:
      typeof result.meta?.regularMarketPrice === "number" ? result.meta.regularMarketPrice : null,
    previousClose: typeof result.meta?.previousClose === "number" ? result.meta.previousClose : null
  };
}

function find1yClose(points: QuotePoint[]): number | null {
  if (points.length === 0) {
    return null;
  }

  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  let candidate: QuotePoint | null = null;
  let minDiff = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const diff = Math.abs(point.date.getTime() - oneYearAgo);
    if (diff < minDiff) {
      minDiff = diff;
      candidate = point;
    }
  }

  return candidate ? candidate.close : null;
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
    const { points, regularMarketPrice, previousClose } = await fetchHistory(watchItem.ticker);
    const closes = points.map((p) => p.close);

    const rsi14 = closes.length >= 200 ? calculateRsiWilder(closes, 14) : null;
    const latestClose = closes.at(-1) ?? null;
    const currentPrice = regularMarketPrice ?? latestClose;

    const changePct1d =
      currentPrice && previousClose && previousClose !== 0
        ? round2(((currentPrice - previousClose) / previousClose) * 100)
        : null;

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
      volume: points.at(-1)?.volume ?? null,
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
