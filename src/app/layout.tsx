import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Non-GBT Completeness Check",
  description: "Fee transaction analysis and GL reconciliation tool - Process fee files, convert currencies using daily exchange rates, and compare against General Ledger data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
