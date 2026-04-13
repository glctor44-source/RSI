"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WATCHLIST } from "@/lib/default-watchlist";
import {
  fromImportPayload,
  loadWatchItems,
  parseTickerInput,
  saveWatchItems,
  toImportPayload
} from "@/lib/storage";
import { BacktestResult, MarketDataResponse, MarketRow, WatchItem } from "@/lib/types";

function fmt(value: number | null, suffix = ""): string {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }
  return `${value.toFixed(2)}${suffix}`;
}

function calcDeviation(rsi14: number | null, recommendedRsi: number | null): number | null {
  if (rsi14 === null || recommendedRsi === null || recommendedRsi <= 0) {
    return null;
  }
  return Math.round((((rsi14 - recommendedRsi) / recommendedRsi) * 100) * 100) / 100;
}

function dateInputValue(offsetDays: number): string {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

type BacktestForm = {
  ticker: string;
  startDate: string;
  endDate: string;
  entryRsi: string;
  exitRsi: string;
  initialCapital: string;
};

function EquityBars({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <div className="text-sm text-black/55">시뮬레이션 결과가 아직 없습니다.</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <div className="flex h-28 items-end gap-[2px] rounded-xl bg-[#f4f1e8] p-3">
      {values.map((value, index) => {
        const heightPct = ((value - min) / range) * 100;
        return (
          <div
            key={`${index}-${value}`}
            className="min-w-0 flex-1 rounded-t bg-gradient-to-t from-[#136f63] to-[#6ec6b8]"
            style={{ height: `${Math.max(heightPct, 6)}%` }}
            title={`${value.toFixed(2)}`}
          />
        );
      })}
    </div>
  );
}

export function Dashboard() {
  const [watchItems, setWatchItems] = useState<WatchItem[]>(DEFAULT_WATCHLIST);
  const [marketRows, setMarketRows] = useState<MarketRow[]>([]);
  const [tickerInput, setTickerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [sortBy, setSortBy] = useState<"rsi" | "deviation" | "return1y">("rsi");
  const [backtestForm, setBacktestForm] = useState<BacktestForm>({
    ticker: DEFAULT_WATCHLIST[0]?.ticker ?? "TQQQ",
    startDate: dateInputValue(-365),
    endDate: dateInputValue(0),
    entryRsi: "30",
    exitRsi: "55",
    initialCapital: "10000"
  });
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tickerSignature = useMemo(() => watchItems.map((item) => item.ticker).join(","), [watchItems]);

  useEffect(() => {
    const saved = loadWatchItems();
    setWatchItems(saved);
  }, []);

  useEffect(() => {
    saveWatchItems(watchItems);
  }, [watchItems]);

  useEffect(() => {
    if (!tickerSignature) {
      setMarketRows([]);
      return;
    }
    void refreshMarketData(watchItems);
  }, [tickerSignature]);

  useEffect(() => {
    if (watchItems.length === 0) {
      setBacktestForm((prev) => ({ ...prev, ticker: "" }));
      return;
    }

    const exists = watchItems.some((item) => item.ticker === backtestForm.ticker);
    if (!exists) {
      setBacktestForm((prev) => ({ ...prev, ticker: watchItems[0].ticker }));
    }
  }, [backtestForm.ticker, watchItems]);

  async function refreshMarketData(items: WatchItem[]) {
    if (items.length === 0) {
      setMarketRows([]);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const tickers = items.map((item) => item.ticker).join(",");
      const response = await fetch(`/api/market-data?tickers=${encodeURIComponent(tickers)}`);
      const json = (await response.json()) as MarketDataResponse;

      setMarketRows(json.rows);
      if (json.errors.length > 0) {
        setMessage(`일부 ticker 조회 실패: ${json.errors.map((e) => e.ticker).join(", ")}`);
      }
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function runBacktest() {
    if (!backtestForm.ticker) {
      setBacktestError("백테스트할 ticker를 선택해주세요.");
      return;
    }

    setBacktestLoading(true);
    setBacktestError("");

    try {
      const params = new URLSearchParams({
        ticker: backtestForm.ticker,
        startDate: backtestForm.startDate,
        endDate: backtestForm.endDate,
        entryRsi: backtestForm.entryRsi,
        exitRsi: backtestForm.exitRsi,
        initialCapital: backtestForm.initialCapital
      });

      const response = await fetch(`/api/backtest?${params.toString()}`);
      const json = (await response.json()) as BacktestResult | { error: string };

      if (!response.ok || "error" in json) {
        throw new Error("error" in json ? json.error : "백테스트 요청에 실패했습니다.");
      }

      setBacktestResult(json);
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : "백테스트 실행에 실패했습니다.");
      setBacktestResult(null);
    } finally {
      setBacktestLoading(false);
    }
  }

  function addTickers() {
    const parsed = parseTickerInput(tickerInput);
    if (parsed.length === 0) {
      setMessage("유효한 ticker를 입력해주세요. 예: QQQ, SPY");
      return;
    }

    const existing = new Set(watchItems.map((item) => item.ticker));
    const next = [...watchItems];

    for (const ticker of parsed) {
      if (!existing.has(ticker)) {
        next.push({ ticker, sector: "Unassigned", recommendedRsi: null });
      }
    }

    setWatchItems(next);
    setTickerInput("");
  }

  function removeTicker(ticker: string) {
    setWatchItems((prev) => prev.filter((item) => item.ticker !== ticker));
  }

  function updateItem(ticker: string, patch: Partial<WatchItem>) {
    setWatchItems((prev) => prev.map((item) => (item.ticker === ticker ? { ...item, ...patch } : item)));
  }

  function exportJson() {
    const payload = toImportPayload(watchItems);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = fromImportPayload(parsed);
      setWatchItems(imported);
      setMessage(`Import 완료: ${imported.length}개 ticker`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Import 실패";
      setMessage(msg);
    }
  }

  const rows = useMemo(() => {
    const rowMap = new Map(marketRows.map((row) => [row.ticker, row]));
    return watchItems.map((item) => {
      const apiRow = rowMap.get(item.ticker);
      if (!apiRow) {
        return {
          ...item,
          rsi14: null,
          rsiDeviationPct: null,
          price: null,
          changePct1d: null,
          price1yAgo: null,
          return1yPct: null,
          volume: null,
          lastUpdatedISO: new Date().toISOString(),
          status: "ERROR" as const,
          error: "데이터를 찾지 못했습니다."
        };
      }
      return {
        ...apiRow,
        sector: item.sector,
        recommendedRsi: item.recommendedRsi,
        rsiDeviationPct: calcDeviation(apiRow.rsi14, item.recommendedRsi)
      };
    });
  }, [marketRows, watchItems]);

  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const av =
        sortBy === "rsi"
          ? a.rsi14
          : sortBy === "deviation"
            ? a.rsiDeviationPct
            : a.return1yPct;
      const bv =
        sortBy === "rsi"
          ? b.rsi14
          : sortBy === "deviation"
            ? b.rsiDeviationPct
            : b.return1yPct;

      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });
    return cloned;
  }, [rows, sortBy]);

  const equityBars = useMemo(() => {
    if (!backtestResult) {
      return [];
    }

    const source = backtestResult.equityCurve;
    if (source.length <= 48) {
      return source.map((point) => point.equity);
    }

    const bucketSize = Math.ceil(source.length / 48);
    const buckets: number[] = [];
    for (let i = 0; i < source.length; i += bucketSize) {
      const chunk = source.slice(i, i + bucketSize);
      buckets.push(chunk[chunk.length - 1].equity);
    }
    return buckets;
  }, [backtestResult]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-[28px] border border-black/10 bg-white/75 p-6 shadow-[0_24px_80px_rgba(46,74,62,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#136f63]">Research Workspace</p>
            <h1 className="m-0 text-3xl font-semibold tracking-tight">ETF RSI Dashboard + Backtest Lab</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-black/70">
              감시 리스트를 관리하면서, 같은 화면에서 RSI 기준 진입/청산 전략을 바로 백테스트할 수 있게 구성했습니다.
            </p>
          </div>
          <div className="rounded-2xl bg-[#f4f1e8] px-4 py-3 text-sm text-black/70">
            전략 기본 가정: 수수료 없음, 슬리피지 없음, 종가 기준 진입/청산
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <input
            className="min-w-[280px] flex-1 rounded-xl border border-black/20 bg-white px-3 py-2"
            placeholder="ticker 입력 (예: TQQQ, SOXL, UPRO)"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
          />
          <button className="rounded-xl bg-[#136f63] px-4 py-2 text-white" onClick={addTickers}>
            추가
          </button>
          <button className="rounded-xl border border-black/20 px-4 py-2" onClick={() => void refreshMarketData(watchItems)}>
            {loading ? "갱신 중..." : "새로고침"}
          </button>
          <button className="rounded-xl border border-black/20 px-4 py-2" onClick={exportJson}>
            Export JSON
          </button>
          <button
            className="rounded-xl border border-black/20 px-4 py-2"
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void importJson(file);
              }
              e.currentTarget.value = "";
            }}
          />
          <select
            className="rounded-xl border border-black/20 bg-white px-3 py-2"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "rsi" | "deviation" | "return1y")}
          >
            <option value="rsi">정렬: RSI</option>
            <option value="deviation">정렬: Deviation %</option>
            <option value="return1y">정렬: 1Y Return %</option>
          </select>
        </div>

        {message ? <p className="mt-3 text-sm text-[#9f4f12]">{message}</p> : null}
      </section>

      <section className="mt-5 overflow-x-auto rounded-[28px] border border-black/10 bg-white/80 p-4 shadow-[0_18px_50px_rgba(46,74,62,0.06)]">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left">
              <th className="p-2">Sector</th>
              <th className="p-2">Ticker</th>
              <th className="p-2">RSI(14)</th>
              <th className="p-2">Recommended RSI</th>
              <th className="p-2">RSI Deviation %</th>
              <th className="p-2">Current Price</th>
              <th className="p-2">Change % (1D)</th>
              <th className="p-2">Price 1Y Ago</th>
              <th className="p-2">Return % (1Y)</th>
              <th className="p-2">Volume</th>
              <th className="p-2">Status</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.ticker} className="border-b border-black/5 align-top">
                <td className="p-2">
                  <input
                    className="w-28 rounded border border-black/15 px-2 py-1"
                    value={row.sector}
                    onChange={(e) => updateItem(row.ticker, { sector: e.target.value })}
                  />
                </td>
                <td className="p-2 font-semibold">{row.ticker}</td>
                <td className="p-2">{fmt(row.rsi14)}</td>
                <td className="p-2">
                  <input
                    className="w-20 rounded border border-black/15 px-2 py-1"
                    type="number"
                    min={1}
                    max={99}
                    value={row.recommendedRsi ?? ""}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : Number(e.target.value);
                      updateItem(row.ticker, {
                        recommendedRsi: typeof value === "number" && value >= 1 && value <= 99 ? Math.round(value) : null
                      });
                    }}
                  />
                </td>
                <td className="p-2">{fmt(row.rsiDeviationPct, "%")}</td>
                <td className="p-2">{fmt(row.price)}</td>
                <td className="p-2">{fmt(row.changePct1d, "%")}</td>
                <td className="p-2">{fmt(row.price1yAgo)}</td>
                <td className="p-2">{fmt(row.return1yPct, "%")}</td>
                <td className="p-2">{row.volume?.toLocaleString() ?? "N/A"}</td>
                <td className="p-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      row.status === "OK"
                        ? "bg-teal-100 text-teal-800"
                        : row.status === "PARTIAL"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {row.status}
                  </span>
                  {row.error ? <div className="mt-1 text-xs text-rose-700">{row.error}</div> : null}
                </td>
                <td className="p-2">
                  <button className="rounded border border-black/20 px-2 py-1" onClick={() => removeTicker(row.ticker)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-black/10 bg-[#fffdf8] p-5 shadow-[0_18px_50px_rgba(46,74,62,0.06)]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#136f63]">Backtest Setup</p>
          <h2 className="m-0 text-2xl font-semibold">RSI 전략 실험</h2>
          <p className="mt-2 text-sm leading-6 text-black/70">
            선택한 종목을 대상으로, RSI가 진입선 이하일 때 매수하고 청산선 이상일 때 전량 매도하는 단순 전략입니다.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block text-sm">
              <div className="mb-1 font-medium">Ticker</div>
              <select
                className="w-full rounded-xl border border-black/20 bg-white px-3 py-2"
                value={backtestForm.ticker}
                onChange={(e) => setBacktestForm((prev) => ({ ...prev, ticker: e.target.value }))}
              >
                {watchItems.map((item) => (
                  <option key={item.ticker} value={item.ticker}>
                    {item.ticker}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <div className="mb-1 font-medium">Start Date</div>
              <input
                className="w-full rounded-xl border border-black/20 bg-white px-3 py-2"
                type="date"
                value={backtestForm.startDate}
                onChange={(e) => setBacktestForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </label>

            <label className="block text-sm">
              <div className="mb-1 font-medium">End Date</div>
              <input
                className="w-full rounded-xl border border-black/20 bg-white px-3 py-2"
                type="date"
                value={backtestForm.endDate}
                onChange={(e) => setBacktestForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <div className="mb-1 font-medium">Entry RSI</div>
                <input
                  className="w-full rounded-xl border border-black/20 bg-white px-3 py-2"
                  type="number"
                  min={1}
                  max={98}
                  value={backtestForm.entryRsi}
                  onChange={(e) => setBacktestForm((prev) => ({ ...prev, entryRsi: e.target.value }))}
                />
              </label>

              <label className="block text-sm">
                <div className="mb-1 font-medium">Exit RSI</div>
                <input
                  className="w-full rounded-xl border border-black/20 bg-white px-3 py-2"
                  type="number"
                  min={2}
                  max={99}
                  value={backtestForm.exitRsi}
                  onChange={(e) => setBacktestForm((prev) => ({ ...prev, exitRsi: e.target.value }))}
                />
              </label>
            </div>

            <label className="block text-sm">
              <div className="mb-1 font-medium">Initial Capital</div>
              <input
                className="w-full rounded-xl border border-black/20 bg-white px-3 py-2"
                type="number"
                min={100}
                step={100}
                value={backtestForm.initialCapital}
                onChange={(e) => setBacktestForm((prev) => ({ ...prev, initialCapital: e.target.value }))}
              />
            </label>

            <button className="w-full rounded-xl bg-[#1f3c88] px-4 py-3 text-white" onClick={() => void runBacktest()}>
              {backtestLoading ? "백테스트 실행 중..." : "백테스트 실행"}
            </button>

            {backtestError ? <p className="text-sm text-rose-700">{backtestError}</p> : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-[0_18px_50px_rgba(46,74,62,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#136f63]">Backtest Result</p>
              <h2 className="m-0 text-2xl font-semibold">성과 요약</h2>
              <p className="mt-2 text-sm text-black/65">
                총 수익률, MDD, 승률과 함께 최근 거래를 바로 확인할 수 있습니다.
              </p>
            </div>
            {backtestResult ? (
              <div className="rounded-2xl bg-[#f4f1e8] px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.18em] text-black/45">Ticker</div>
                <div className="text-2xl font-semibold">{backtestResult.summary.ticker}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <EquityBars values={equityBars} />
          </div>

          {backtestResult ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl bg-[#f8faf7] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45">Final Equity</div>
                  <div className="mt-2 text-2xl font-semibold">${fmt(backtestResult.summary.finalEquity)}</div>
                </div>
                <div className="rounded-2xl bg-[#f8faf7] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45">Strategy Return</div>
                  <div className="mt-2 text-2xl font-semibold">{fmt(backtestResult.summary.totalReturnPct, "%")}</div>
                </div>
                <div className="rounded-2xl bg-[#f8faf7] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45">Buy & Hold</div>
                  <div className="mt-2 text-2xl font-semibold">{fmt(backtestResult.summary.buyAndHoldReturnPct, "%")}</div>
                </div>
                <div className="rounded-2xl bg-[#f8faf7] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45">Annualized</div>
                  <div className="mt-2 text-2xl font-semibold">{fmt(backtestResult.summary.annualizedReturnPct, "%")}</div>
                </div>
                <div className="rounded-2xl bg-[#f8faf7] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45">Max Drawdown</div>
                  <div className="mt-2 text-2xl font-semibold">{fmt(backtestResult.summary.maxDrawdownPct, "%")}</div>
                </div>
                <div className="rounded-2xl bg-[#f8faf7] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45">Trades / Win Rate</div>
                  <div className="mt-2 text-2xl font-semibold">
                    {backtestResult.summary.tradeCount} / {fmt(backtestResult.summary.winRatePct, "%")}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-black/10">
                <div className="border-b border-black/10 px-4 py-3 text-sm font-medium">최근 거래 내역</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-left">
                        <th className="px-4 py-3">Entry</th>
                        <th className="px-4 py-3">Exit</th>
                        <th className="px-4 py-3">Entry Px</th>
                        <th className="px-4 py-3">Exit Px</th>
                        <th className="px-4 py-3">Return</th>
                        <th className="px-4 py-3">P/L</th>
                        <th className="px-4 py-3">Bars</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtestResult.trades.length > 0 ? (
                        [...backtestResult.trades].slice(-8).reverse().map((trade) => (
                          <tr key={`${trade.entryDateISO}-${trade.exitDateISO}`} className="border-b border-black/5">
                            <td className="px-4 py-3">{trade.entryDateISO.slice(0, 10)}</td>
                            <td className="px-4 py-3">{trade.exitDateISO.slice(0, 10)}</td>
                            <td className="px-4 py-3">{fmt(trade.entryPrice)}</td>
                            <td className="px-4 py-3">{fmt(trade.exitPrice)}</td>
                            <td className={`px-4 py-3 ${trade.returnPct >= 0 ? "text-teal-700" : "text-rose-700"}`}>
                              {fmt(trade.returnPct, "%")}
                            </td>
                            <td className={`px-4 py-3 ${trade.profitLoss >= 0 ? "text-teal-700" : "text-rose-700"}`}>
                              {fmt(trade.profitLoss)}
                            </td>
                            <td className="px-4 py-3">{trade.barsHeld}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-4 text-black/55" colSpan={7}>
                            선택한 기간에는 완료된 거래가 없었습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-2xl bg-[#f8faf7] p-5 text-sm leading-6 text-black/65">
              왼쪽에서 종목과 기간을 고른 뒤 백테스트를 실행하면, 전략 수익률과 거래 로그가 여기에 표시됩니다.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
