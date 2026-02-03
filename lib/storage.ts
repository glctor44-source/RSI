import { DEFAULT_WATCHLIST } from "@/lib/default-watchlist";
import { WatchItem, WatchlistImport } from "@/lib/types";

export const STORAGE_KEY = "etf-rsi-dashboard/watch-items/v1";

const TICKER_RE = /^[A-Z0-9-]+$/;

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

export function parseTickerInput(input: string): string[] {
  const items = input
    .split(",")
    .map((part) => normalizeTicker(part))
    .filter(Boolean)
    .filter((ticker) => TICKER_RE.test(ticker));

  return [...new Set(items)].slice(0, 50);
}

export function sanitizeWatchItems(items: WatchItem[]): WatchItem[] {
  const seen = new Set<string>();
  const out: WatchItem[] = [];

  for (const item of items) {
    const ticker = normalizeTicker(item.ticker);
    if (!ticker || seen.has(ticker) || !TICKER_RE.test(ticker)) {
      continue;
    }

    const recommendedRsi =
      typeof item.recommendedRsi === "number" && item.recommendedRsi >= 1 && item.recommendedRsi <= 99
        ? Math.round(item.recommendedRsi)
        : null;

    out.push({
      ticker,
      sector: item.sector?.trim() || "Unassigned",
      recommendedRsi
    });

    seen.add(ticker);
    if (out.length >= 50) {
      break;
    }
  }

  return out;
}

export function loadWatchItems(): WatchItem[] {
  if (typeof window === "undefined") {
    return DEFAULT_WATCHLIST;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WATCHLIST;
    }

    const parsed = JSON.parse(raw) as WatchItem[];
    const sanitized = sanitizeWatchItems(parsed);
    return sanitized.length > 0 ? sanitized : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

export function saveWatchItems(items: WatchItem[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const sanitized = sanitizeWatchItems(items);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

export function toImportPayload(items: WatchItem[]): WatchlistImport {
  return {
    version: 1,
    exportedAtISO: new Date().toISOString(),
    watchItems: sanitizeWatchItems(items)
  };
}

export function fromImportPayload(value: unknown): WatchItem[] {
  if (!value || typeof value !== "object") {
    throw new Error("유효한 JSON 객체가 아닙니다.");
  }

  const payload = value as Partial<WatchlistImport>;
  if (payload.version !== 1 || !Array.isArray(payload.watchItems)) {
    throw new Error("지원하지 않는 Import 포맷입니다.");
  }

  const sanitized = sanitizeWatchItems(payload.watchItems);
  if (sanitized.length === 0) {
    throw new Error("불러올 watchItems가 없습니다.");
  }

  return sanitized;
}
