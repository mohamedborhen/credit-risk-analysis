"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import apiClient from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const { access_token, user_id, role, credits } = response.data;

      // Seed global context with credits from API — fixes false positive credit modal
      console.log("[LOGIN] credits from API:", credits);
      login({ id: user_id, email, role, credits: credits ?? 5 }, access_token);

      // Redirect based on role
      if (role === "PME") {
        router.push("/dashboard/pme");
      } else {
        router.push("/dashboard/investor");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to login. Please check your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-32 min-h-screen px-6 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] -z-10"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-10 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 max-w-md w-full shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-400 text-sm">Sign in to your FinScore account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-white outline-none"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-white outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-teal-500 text-slate-950 font-bold flex items-center justify-center hover:bg-teal-400 transition-all disabled:opacity-50 mt-4 active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Sign In <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-8">
          Don't have an account?{" "}
          <Link href="/register" className="text-teal-400 hover:text-teal-300 font-medium">
            Create Profile
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
