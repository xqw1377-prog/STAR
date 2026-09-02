import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DbProvider } from "@/app/providers";

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
  title: "STAR Desk",
  description: "Read-only Solana opportunity intelligence with hard safety gates",
};

const NAV = [
  { href: "/", label: "STAR Desk" },
  { href: "/narrative-map", label: "Narrative Radar" },
  { href: "/project/proj-neural", label: "Project Audit" },
  { href: "/replay-lab", label: "Replay Lab" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geistSans.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="font-mono text-sm font-bold tracking-widest">
              STAR
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                SYNTHETIC FIXTURE DATA · READ-ONLY · NO WALLET · NO TRADING
              </span>
          </div>
        </header>
        <DbProvider>{children}</DbProvider>
      </body>
    </html>
  );
}
