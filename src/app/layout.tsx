import type { Metadata } from "next";
import "./globals.css";
import "./capex.css";
import "./opex.css";

export const metadata: Metadata = {
  title: "AyurVaidya — Dashboard",
  description: "CAPEX dashboard for AyurVaidya",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
