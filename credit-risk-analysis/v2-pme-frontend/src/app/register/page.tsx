"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import apiClient from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "PME",
    company_name: "",
    identifiant_unique_rne: "",
    governorate: "Tunis",
    sector: "Technology",
    contact_phone: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Register User
      const registerPayload = 
        formData.role === "PME" 
          ? { ...formData, contact_email: formData.email } // Explicitly copy auth email to contact_email
          : { email: formData.email, password: formData.password, role: formData.role };
          
      const response = await apiClient.post("/auth/register", registerPayload);
      const { access_token, user_id, role, credits } = response.data;

      // 2. Seed global auth state with credits from the register response
      console.log("[REGISTER] credits from API:", credits);
      login({ id: user_id, email: formData.email, role, credits: credits ?? 5 }, access_token);

      // 3. Redirect
      if (role === "PME") {
        router.push("/dashboard/pme");
      } else {
        router.push("/dashboard/investor");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to register profile. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-24 min-h-screen px-6 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] -z-10"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-10 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 max-w-md w-full shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create FinScore Profile</h1>
          <p className="text-gray-400 text-sm">Join the leading alternative credit network</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: "PME" })}
              className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                formData.role === "PME" 
                  ? "bg-teal-500/20 border-teal-500 text-teal-400" 
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              }`}
            >
              SME Profile
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: "BANK" })}
              className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                formData.role === "BANK" 
                  ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" 
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              }`}
            >
              Investor / Bank
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-white outline-none"
              placeholder="contact@company.com"
            />
          </div>

          {formData.role === "PME" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Company Name</label>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-white outline-none mb-4"
                placeholder="TechCorp SME"
              />
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">ID RNE</label>
                  <input
                    type="text"
                    required
                    value={formData.identifiant_unique_rne}
                    onChange={(e) => setFormData({ ...formData, identifiant_unique_rne: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 transition-all text-white outline-none"
                    placeholder="12345/A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Governorate</label>
                  <select
                    value={formData.governorate}
                    onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 transition-all text-white outline-none [&>option]:bg-slate-900"
                  >
                    <option value="Tunis">Tunis</option>
                    <option value="Sfax">Sfax</option>
                    <option value="Sousse">Sousse</option>
                    <option value="Ariana">Ariana</option>
                    <option value="Bizerte">Bizerte</option>
                    <option value="Nabeul">Nabeul</option>
                  </select>
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Business Sector</label>
              <select
                value={formData.sector}
                onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 transition-all text-white outline-none mb-4 [&>option]:bg-slate-900"
              >
                <option value="Technology">Technology / IT</option>
                <option value="Agriculture">Agriculture</option>
                <option value="Services">Services</option>
                <option value="Textile">Textile</option>
                <option value="Construction">Construction</option>
              </select>

              <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Phone Number</label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 transition-all text-white outline-none mb-4"
                placeholder="+216 20 123 456"
              />
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-white outline-none"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-teal-500 text-slate-950 font-bold flex items-center justify-center hover:bg-teal-400 transition-all disabled:opacity-50 mt-6 active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-8">
          Already have an account?{" "}
          <Link href="/login" className="text-teal-400 hover:text-teal-300 font-medium">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
