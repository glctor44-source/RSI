import { fetchPriceHistory } from "@/lib/finance";
import { calculateRsiWilder, round2 } from "@/lib/rsi";
import { BacktestEquityPoint, BacktestResult, BacktestTrade, PriceHistoryPoint } from "@/lib/types";

type BacktestParams = {
  ticker: string;
  startDateISO: string;
  endDateISO: string;
  entryRsi: number;
  exitRsi: number;
  initialCapital: number;
};

type OpenPosition = {
  entryDateISO: string;
  entryPrice: number;
  shares: number;
  entryEquity: number;
  entryIndex: number;
};

function clampDateRange(points: PriceHistoryPoint[], startDateISO: string, endDateISO: string): PriceHistoryPoint[] {
  const start = new Date(startDateISO).getTime();
  const end = new Date(endDateISO).getTime();

  return points.filter((point) => {
    const time = new Date(point.dateISO).getTime();
    return time >= start && time <= end;
  });
}

function calcAnnualizedReturn(totalReturnPct: number, bars: number): number | null {
  if (bars <= 1) {
    return null;
  }

  const totalReturn = totalReturnPct / 100;
  if (1 + totalReturn <= 0) {
    return null;
  }

  const years = bars / 252;
  if (years <= 0) {
    return null;
  }

  return round2((Math.pow(1 + totalReturn, 1 / years) - 1) * 100);
}

export async function runRsiBacktest(params: BacktestParams): Promise<BacktestResult> {
  const history = await fetchPriceHistory(params.ticker);
  const filtered = clampDateRange(history, params.startDateISO, params.endDateISO);

  if (filtered.length < 30) {
    throw new Error("백테스트를 실행하려면 선택한 기간에 최소 30영업일 이상의 데이터가 필요합니다.");
  }

  let cash = params.initialCapital;
  let shares = 0;
  let openPosition: OpenPosition | null = null;
  let peakEquity = params.initialCapital;
  let maxDrawdownPct = 0;

  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];

  for (let i = 0; i < filtered.length; i += 1) {
    const window = filtered.slice(0, i + 1).map((point) => point.close);
    const point = filtered[i];
    const rsi14 = calculateRsiWilder(window, 14);

    let signal: "BUY" | "SELL" | "HOLD" = "HOLD";

    if (rsi14 !== null && shares === 0 && rsi14 <= params.entryRsi) {
      shares = cash / point.close;
      openPosition = {
        entryDateISO: point.dateISO,
        entryPrice: point.close,
        shares,
        entryEquity: cash,
        entryIndex: i
      };
      cash = 0;
      signal = "BUY";
    } else if (rsi14 !== null && shares > 0 && rsi14 >= params.exitRsi) {
      const equityBeforeSell = shares * point.close;
      const pnl = equityBeforeSell - (openPosition?.entryEquity ?? equityBeforeSell);

      trades.push({
        entryDateISO: openPosition?.entryDateISO ?? point.dateISO,
        entryPrice: openPosition?.entryPrice ?? point.close,
        exitDateISO: point.dateISO,
        exitPrice: point.close,
        returnPct: round2(
          (((point.close - (openPosition?.entryPrice ?? point.close)) / (openPosition?.entryPrice ?? point.close)) * 100)
        ),
        profitLoss: round2(pnl),
        barsHeld: openPosition ? i - openPosition.entryIndex : 0
      });

      cash = equityBeforeSell;
      shares = 0;
      openPosition = null;
      signal = "SELL";
    }

    const equity = cash + shares * point.close;
    peakEquity = Math.max(peakEquity, equity);
    const drawdownPct = peakEquity === 0 ? 0 : round2(((equity - peakEquity) / peakEquity) * 100);
    maxDrawdownPct = Math.min(maxDrawdownPct, drawdownPct);

    equityCurve.push({
      dateISO: point.dateISO,
      close: round2(point.close),
      rsi14: rsi14 === null ? null : round2(rsi14),
      signal,
      position: shares > 0 ? 1 : 0,
      cash: round2(cash),
      shares: round2(shares),
      equity: round2(equity),
      drawdownPct
    });
  }

  const finalEquity = equityCurve.at(-1)?.equity ?? params.initialCapital;
  const totalReturnPct = round2(((finalEquity - params.initialCapital) / params.initialCapital) * 100);
  const startClose = filtered[0]?.close ?? null;
  const endClose = filtered.at(-1)?.close ?? null;
  const buyAndHoldReturnPct =
    startClose && endClose ? round2(((endClose - startClose) / startClose) * 100) : null;
  const winningTrades = trades.filter((trade) => trade.profitLoss > 0).length;
  const winRatePct = trades.length > 0 ? round2((winningTrades / trades.length) * 100) : null;

  return {
    summary: {
      ticker: params.ticker,
      startDateISO: filtered[0].dateISO,
      endDateISO: filtered.at(-1)?.dateISO ?? filtered[0].dateISO,
      initialCapital: round2(params.initialCapital),
      finalEquity: round2(finalEquity),
      totalReturnPct,
      annualizedReturnPct: calcAnnualizedReturn(totalReturnPct, filtered.length),
      buyAndHoldReturnPct,
      maxDrawdownPct: round2(maxDrawdownPct),
      tradeCount: trades.length,
      winRatePct
    },
    trades,
    equityCurve
  };
}
