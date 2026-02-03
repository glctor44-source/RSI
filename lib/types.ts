export type RowStatus = "OK" | "PARTIAL" | "ERROR";

export type WatchItem = {
  ticker: string;
  sector: string;
  recommendedRsi: number | null;
};

export type MarketRow = WatchItem & {
  rsi14: number | null;
  rsiDeviationPct: number | null;
  price: number | null;
  changePct1d: number | null;
  price1yAgo: number | null;
  return1yPct: number | null;
  volume: number | null;
  lastUpdatedISO: string;
  status: RowStatus;
  error?: string;
};

export type MarketDataResponse = {
  requestedAtISO: string;
  rows: MarketRow[];
  errors: { ticker: string; message: string }[];
};

export type WatchlistImport = {
  version: 1;
  exportedAtISO: string;
  watchItems: WatchItem[];
};
