import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import Link from "next/link";
import "./globals.css";
import { cn } from "@/lib/utils";
import { BOUNDARY_ZH, BOUNDARY_EN, NAV_ZH } from "@/lib/ui/zh";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "STAR 阻击台",
  description: "新叙事早期资产阻击 · Event → Narrative → Asset · DRY_RUN",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = headers().get("x-nonce") ?? undefined;
  return (
    <html lang="zh-CN" className={cn("font-sans", geistSans.variable)} nonce={nonce}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="font-mono text-sm font-bold tracking-widest">
              STAR
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              {NAV_ZH.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
              <span
                data-testid="synthetic-fixture-banner"
                className="ml-auto text-right font-mono text-[11px] leading-tight text-muted-foreground"
              >
                <span className="block">{BOUNDARY_ZH}</span>
                <span className="block">{BOUNDARY_EN}</span>
              </span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
