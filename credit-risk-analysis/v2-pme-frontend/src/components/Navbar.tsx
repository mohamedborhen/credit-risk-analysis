"use client";

import { useEffect, useState, createContext, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User, Coins, AlertCircle, X, UserX } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import apiClient from "@/lib/api/axios";

// ── Credits API helper (exported so other pages can re-trigger a refresh) ──
export const CreditsRefreshContext = createContext<() => void>(() => {});
export const useCreditsRefresh = () => useContext(CreditsRefreshContext);

// ── Insufficient Credits Modal ─────────────────────────────────────────────
export function InsufficientCreditsModal({ onClose }: { onClose: () => void }) {
  const modalRouter = useRouter();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-sm w-full shadow-2xl mx-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Insufficient Credits</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            You have no credits left to unlock contacts.<br />
            Every new account starts with <strong className="text-teal-400">5 free credits</strong>.
          </p>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-all"
            >
              Close
            </button>
            <button
              onClick={() => { onClose(); modalRouter.push("/pricing"); }}
              className="flex-1 py-2.5 rounded-xl bg-teal-500 text-slate-950 text-sm font-bold hover:bg-teal-400 transition-all"
            >
              Recharge 🔋
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Navbar ────────────────────────────────────────────────────────────
export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout, hydrateAuth, updateCredits } = useAuthStore();

  // fetchCredits: called by CreditsRefreshContext consumers (e.g. after unlock)
  const fetchCredits = () => {
    if (!isAuthenticated) return;
    apiClient.get("/auth/me")
      .then(res => {
        console.log("[NAVBAR] /auth/me credits:", res.data.credits);
        updateCredits(res.data.credits); // updates store AND localStorage
      })
      .catch(err => console.warn("[NAVBAR] /auth/me failed:", err.message));
  };

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // On first login, credits come from authStore (seeded at login).
  // Only call /auth/me when we know user is authenticated but credits might be stale.
  useEffect(() => {
    if (isAuthenticated) fetchCredits();
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Warning: This will permanently delete your account, your credits, and all saved predictions. This action cannot be undone."
    );
    if (!confirmDelete) return;

    try {
      const res = await apiClient.delete("/auth/account");
      if (res.data.status === "success") {
        logout();
        router.push("/login");
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to delete account.");
    }
  };

  // credits read directly from store — always in sync
  const credits = user?.credits ?? null;

  return (
    <CreditsRefreshContext.Provider value={fetchCredits}>
      <nav className="fixed top-0 w-full z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">

          {/* Logo */}
          <Link href="/" className="text-2xl font-bold tracking-tighter">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-500">
              FinScore PME
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-3">

            {/* TASK 3: Marketplace only shown when authenticated */}
            {isAuthenticated && (
              <Link
                href="/marketplace"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Marketplace
              </Link>
            )}

            {isAuthenticated && user ? (
              <>
                <Link
                  href={user.role === "PME" ? "/dashboard/pme" : "/dashboard/investor"}
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>


                {/* Credit Badge */}
                {credits !== null && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                    credits === 0
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-teal-500/10 border-teal-500/20 text-teal-400"
                  }`}>
                    <Coins className="w-3.5 h-3.5" />
                    {credits} credit{credits !== 1 ? "s" : ""}
                  </div>
                )}

                {/* User Email Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  <User className="w-4 h-4 text-teal-400" />
                  <span className="text-sm text-gray-300 max-w-[140px] truncate">{user.email}</span>
                </div>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-bold hover:bg-white/5 transition-all active:scale-95 flex items-center gap-1.5"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                {/* Delete Account */}
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/10 transition-all active:scale-95 flex items-center gap-1.5"
                  title="Delete My Account"
                >
                  <UserX className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-xl bg-teal-500 text-slate-950 text-sm font-bold hover:bg-teal-400 transition-all shadow-[0_0_15px_rgba(45,212,191,0.3)] active:scale-95"
                >
                  Get My FinScore
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </CreditsRefreshContext.Provider>
  );
}
