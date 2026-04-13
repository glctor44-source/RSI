export type RowStatus = "OK" | "PARTIAL" | "ERROR";

export type WatchItem = {
  ticker: string;
  sector: string;
  recommendedRsi: number | null;
};

export type PriceHistoryPoint = {
  dateISO: string;
  close: number;
  volume: number | null;
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

export type BacktestTrade = {
  entryDateISO: string;
  entryPrice: number;
  exitDateISO: string;
  exitPrice: number;
  returnPct: number;
  profitLoss: number;
  barsHeld: number;
};

export type BacktestEquityPoint = {
  dateISO: string;
  close: number;
  rsi14: number | null;
  signal: "BUY" | "SELL" | "HOLD";
  position: 0 | 1;
  cash: number;
  shares: number;
  equity: number;
  drawdownPct: number;
};

export type BacktestSummary = {
  ticker: string;
  startDateISO: string;
  endDateISO: string;
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  annualizedReturnPct: number | null;
  buyAndHoldReturnPct: number | null;
  maxDrawdownPct: number;
  tradeCount: number;
  winRatePct: number | null;
};

export type BacktestResult = {
  summary: BacktestSummary;
  trades: BacktestTrade[];
  equityCurve: BacktestEquityPoint[];
};
