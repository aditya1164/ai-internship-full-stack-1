import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZeroCode AI — Metadata-Driven App Generator",
  description: "Generate and preview complete full-stack web applications dynamically from JSON schema metadata.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <body className="h-full bg-[#0a0a0c] text-[#ededef] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
