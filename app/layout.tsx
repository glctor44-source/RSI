import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETF RSI Dashboard",
  description: "Track ETF RSI and custom recommended RSI deviations"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
