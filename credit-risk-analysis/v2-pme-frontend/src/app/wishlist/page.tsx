"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Trash2, MapPin, Building, Lock } from "lucide-react";
import apiClient from "@/lib/api/axios";
import AuthGuard from "@/components/AuthGuard";

interface SMEProfile {
  id: string;
  name: string;
  sector: string;
  governorate: string;
  identifiantRne: string;
  financialGrade: string;
  finScore: number;
  riskTier: string;
  contactUnlocked: boolean;
}

const getTierColor = (tier: string) => {
  if (tier.toLowerCase().includes("low")) return "text-teal-400 bg-teal-400/10 border-teal-400/20";
  if (tier.toLowerCase().includes("medium")) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  if (tier.toLowerCase().includes("high")) return "text-red-400 bg-red-400/10 border-red-400/20";
  return "text-gray-400 bg-gray-400/10 border-gray-400/20";
};

export default function WishlistPage() {
  const [savedSmes, setSavedSmes] = useState<SMEProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const res = await apiClient.get("/wishlist");
        if (res.data.status === "success" && res.data.profiles) {
          setSavedSmes(res.data.profiles);
        }
      } catch (err) {
        console.error("Failed to load wishlist");
      } finally {
        setIsLoading(false);
      }
    };
    fetchWishlist();
  }, []);

  const handleRemove = async (id: string) => {
    try {
      const res = await apiClient.delete(`/wishlist/${id}`);
      if (res.data.status === "success") {
        setSavedSmes((prev) => prev.filter((sme) => sme.id !== id));
      }
    } catch (err) {
      alert("Failed to remove from wishlist");
    }
  };

  return (
    <AuthGuard>
      <div className="pt-32 pb-24 min-h-screen px-6 relative overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[150px] -z-10" />
        
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Prediction History</h1>
            <p className="text-gray-400">
              Access all the SME companies you've saved for in-depth monitoring.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
            </div>
          ) : savedSmes.length === 0 ? (
            <div className="text-center py-24 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
              <Lock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-300">No saved history</h3>
              <p className="text-gray-500 mt-2">Save your predictions to find them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedSmes.map((sme) => (
                <motion.div
                  key={sme.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all group relative overflow-hidden shadow-xl"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1 truncate pr-8">{sme.name}</h3>
                      <div className="text-xs text-gray-400 flex flex-col gap-1">
                        <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" /> {sme.governorate}</span>
                        <span className="flex items-center"><Building className="w-3.5 h-3.5 mr-1" /> {sme.sector}</span>
                      </div>
                    </div>
                    
                    {/* The Remove Button */}
                    <button
                      onClick={() => handleRemove(sme.id)}
                      title="Remove from favorites"
                      className="absolute top-6 right-6 p-2 rounded-full bg-rose-500/10 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm p-3 bg-black/20 rounded-xl">
                      <span className="text-gray-400">Evaluated FinScore</span>
                      <span className="font-black text-lg text-white">{sme.finScore} <span className="text-xs text-gray-500">/1000</span></span>
                    </div>
                    <div className="flex justify-between items-center text-sm p-3 bg-black/20 rounded-xl">
                      <span className="text-gray-400">Risk Evaluation</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded border ${getTierColor(sme.riskTier)}`}>
                        {sme.riskTier}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
