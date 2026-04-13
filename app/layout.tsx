import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETF RSI Dashboard + Backtest Lab",
  description: "Track ETF RSI, compare custom thresholds, and backtest simple RSI trading rules"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
