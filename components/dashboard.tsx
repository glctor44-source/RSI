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
import { MarketDataResponse, MarketRow, WatchItem } from "@/lib/types";

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

export function Dashboard() {
  const [watchItems, setWatchItems] = useState<WatchItem[]>(DEFAULT_WATCHLIST);
  const [marketRows, setMarketRows] = useState<MarketRow[]>([]);
  const [tickerInput, setTickerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [sortBy, setSortBy] = useState<"rsi" | "deviation" | "return1y">("rsi");
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

  async function refreshMarketData(items: WatchItem[]) {
    if (items.length === 0) {
      setRows([]);
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-2xl border border-black/10 bg-white/70 p-5 backdrop-blur">
        <h1 className="m-0 text-2xl font-semibold">ETF RSI Dashboard</h1>
        <p className="mt-2 text-sm text-black/70">권장 RSI 대비 괴리율로 관찰 우선순위를 빠르게 확인합니다.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[280px] flex-1 rounded-lg border border-black/20 bg-white px-3 py-2"
            placeholder="ticker 입력 (예: TQQQ, SOXL, UPRO)"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
          />
          <button className="rounded-lg bg-accent px-3 py-2 text-white" onClick={addTickers}>
            추가
          </button>
          <button className="rounded-lg border border-black/20 px-3 py-2" onClick={() => void refreshMarketData(watchItems)}>
            {loading ? "갱신 중..." : "새로고침"}
          </button>
          <button className="rounded-lg border border-black/20 px-3 py-2" onClick={exportJson}>
            Export JSON
          </button>
          <button
            className="rounded-lg border border-black/20 px-3 py-2"
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
            className="rounded-lg border border-black/20 bg-white px-3 py-2"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "rsi" | "deviation" | "return1y")}
          >
            <option value="rsi">정렬: RSI</option>
            <option value="deviation">정렬: Deviation %</option>
            <option value="return1y">정렬: 1Y Return %</option>
          </select>
        </div>

        {message ? <p className="mt-3 text-sm text-warning">{message}</p> : null}
      </section>

      <section className="mt-4 overflow-x-auto rounded-2xl border border-black/10 bg-white/80 p-3">
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
                  {row.error ? <div className="mt-1 text-xs text-danger">{row.error}</div> : null}
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
    </main>
  );
}
