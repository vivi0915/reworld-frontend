import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "re:world｜會員系統",
  description: "進入 re:world，選擇你的屬性並解鎖今晚的獎勵。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
