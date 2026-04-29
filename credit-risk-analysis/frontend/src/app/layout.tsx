import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ChatbotWidget from "@/components/ChatbotWidget";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinScore PME",
  description: "Redefining Credit for Tunisian SMEs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="fixed top-0 w-full z-50 glass-panel border-b-0 rounded-none px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-bold tracking-wider text-white">
            FIN<span className="text-neon-green">SCORE</span> PME
          </div>
          <div className="space-x-6 flex items-center">
            <a href="/dashboard/investor" className="text-sm text-gray-300 hover:text-white transition-colors">Marketplace</a>
            <a href="/login" className="text-sm font-medium px-4 py-2 rounded-full border border-neon-green text-neon-green hover:bg-neon-green/10 transition-colors">Sign In</a>
          </div>
        </nav>
        <main className="pt-24 min-h-screen">
          {children}
        </main>
        <ChatbotWidget />
      </body>
    </html>
  );
}
