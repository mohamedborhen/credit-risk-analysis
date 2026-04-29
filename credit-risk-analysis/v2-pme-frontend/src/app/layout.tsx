import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatbotWidget from "@/components/ChatbotWidget";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinScore PME | Redefining SME Credit",
  description: "Innovative AI-driven Fintech platform for Tunisian SMEs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Force dark mode permanently — no theme switching
    <html lang="en" className="dark">
      <body
        className={`${inter.className} bg-slate-950 text-slate-50 antialiased`}
      >
        <Navbar />
        {children}
        <Footer />
        <ChatbotWidget />
      </body>
    </html>
  );
}
