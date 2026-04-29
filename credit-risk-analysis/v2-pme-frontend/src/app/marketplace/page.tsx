"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, TrendingUp, AlertTriangle, ShieldCheck, Loader2, MapPin, Building, Lock, Unlock, Mail, Phone, ExternalLink, Heart } from "lucide-react";
import apiClient from "@/lib/api/axios";
import { InsufficientCreditsModal, useCreditsRefresh } from "@/components/Navbar";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import { useRouter } from "next/navigation";

// ── Clearbit Logo with initial-circle fallback ──────────────────────────────
function CompanyLogo({ name, website }: { name: string; website?: string }) {
  const [imgError, setImgError] = useState(false);
  const initial = name?.charAt(0).toUpperCase() || "?";
  const colors = ["bg-indigo-500", "bg-teal-500", "bg-purple-500", "bg-orange-500", "bg-rose-500"];
  const colorIdx = name.charCodeAt(0) % colors.length;

  if (website && !imgError) {
    const domain = website.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return (
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={`${name} logo`}
        onError={() => setImgError(true)}
        className="w-9 h-9 rounded-lg object-contain bg-white p-0.5"
      />
    );
  }

  return (
    <div className={`w-9 h-9 rounded-lg ${colors[colorIdx]} flex items-center justify-center font-bold text-white text-sm flex-shrink-0`}>
      {initial}
    </div>
  );
}


// Fallback Mock Data using the new schema
const MOCK_SMES = [
  { id: "1", name: "TechMakers Tunis", sector: "Technology", governorate: "Tunis", identifiantRne: "12345/A", financialGrade: "Grade A", finScore: 780, riskTier: "Low", cnssRatio: "98%", contactUnlocked: false },
  { id: "2", name: "AgriSud Sfax", sector: "Agriculture", governorate: "Sfax", identifiantRne: "67890/B", financialGrade: "Grade B", finScore: 610, riskTier: "Medium", cnssRatio: "85%", contactUnlocked: false },
  { id: "3", name: "Carthage Logistics", sector: "Transport", governorate: "Ariana", identifiantRne: "44421/C", financialGrade: "Grade A", finScore: 710, riskTier: "Low", cnssRatio: "92%", contactUnlocked: false },
  { id: "4", name: "MedTex Bizerte", sector: "Textile", governorate: "Bizerte", identifiantRne: "55512/D", financialGrade: "Grade C", finScore: 480, riskTier: "High", cnssRatio: "60%", contactUnlocked: false },
];

interface SME {
  id: string;
  name: string;
  sector: string;
  governorate: string;
  identifiantRne: string;
  financialGrade: string;
  finScore: number;
  riskTier: string;
  cnssRatio?: string;
  contactUnlocked: boolean;
  contactEmail?: string;
  contactPhone?: string;
}

const getScoreColor = (riskTier: string) => {
  if (riskTier === "Low") return "text-teal-400";
  if (riskTier === "High") return "text-red-400";
  return "text-yellow-400";
};

export default function MarketplacePage() {
  const router = useRouter();
  const refreshCredits = useCreditsRefresh();
  const { user, updateCredits } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [smeData, setSmeData] = useState<SME[]>(MOCK_SMES);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"live" | "mock">("mock");
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  // Lead Generation Modal State
  const [selectedSme, setSelectedSme] = useState<SME | null>(null);
  const [similarSmes, setSimilarSmes] = useState<SME[]>([]);
  const [isUnlocking, setIsUnlocking] = useState(false);
  useEffect(() => {
    fetchMarketplace();
  }, []);


  const fetchMarketplace = async () => {
    try {
      console.log("[MARKETPLACE] Fetching listings from /marketplace/browse");
      const res = await apiClient.get("/marketplace/browse");
      const listings = res.data.listings;
      console.log("[MARKETPLACE] Received", listings?.length ?? 0, "listings.");

      if (listings && listings.length > 0) {
        const mapped: SME[] = listings.map((item: any, index: number) => ({
          id: item.profile_id || String(index + 1),
          name: item.company_name || "Unknown SME",
          sector: item.sector || "N/A",
          governorate: item.governorate || "N/A",
          identifiantRne: item.identifiant_unique_rne || `N/A-${index}`,
          financialGrade: item.financial_grade || "Grade Unknown",
          finScore: item.latest_fin_score ?? 0,
          riskTier: item.latest_risk_tier ?? "N/A",
          contactUnlocked: item.contact_unlocked || false,
        }));
        setSmeData(mapped);
        setDataSource("live");
      }
    } catch (err: any) {
      console.warn("[MARKETPLACE] API unavailable, using demo data. Error:", err?.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmeClick = async (sme: SME) => {
    setSelectedSme(sme);
    setSimilarSmes([]); // Reset similar
    if (dataSource === "live") {
      try {
        const res = await apiClient.get(`/marketplace/${sme.id}/similar`);
        const listings = res.data.listings;
        if (listings) {
          setSimilarSmes(listings.map((item: any) => ({
            id: item.profile_id,
            name: item.company_name,
            sector: item.sector,
            governorate: item.governorate,
            identifiantRne: item.identifiant_unique_rne,
            financialGrade: item.financial_grade,
            finScore: item.latest_fin_score ?? 0,
            riskTier: item.latest_risk_tier ?? "N/A",
            contactUnlocked: false,
          })));
        }
      } catch (err) {
        console.warn("Failed to load similar SMEs");
      }
    }
  };

  const unlockContact = async (pmeId: string) => {
    if (!selectedSme || selectedSme.id !== pmeId) return;
    setIsUnlocking(true);

    try {
      if (dataSource === "mock") {
        await new Promise(r => setTimeout(r, 1000));
        setSelectedSme(prev => prev ? {
          ...prev,
          contactUnlocked: true,
          contactEmail: `contact@${prev.name.toLowerCase().replace(/\s+/g, "")}.tn`,
          contactPhone: "+216 71 123 456",
        } : null);
        console.log("[UNLOCK] Mock unlock completed for", selectedSme.name);
      } else {
        console.log("[UNLOCK] Calling /marketplace/" + selectedSme.id + "/unlock_contact");
        const res = await apiClient.post(`/marketplace/${pmeId}/unlock_contact`);
        if (res.data.success) {
          const unlockedData = res.data; // Ensure the backend returns the full unlocked profile
          
          // 1. Update the main list so the card knows it's unlocked
          setSmeData(prevSmes => prevSmes.map(sme => 
            sme.id === selectedSme.id ? { ...sme, ...unlockedData, contactUnlocked: true, contactEmail: unlockedData.contact_email, contactPhone: unlockedData.contact_phone } : sme
          ));

          // 2. Update the currently selected modal state explicitly
          setSelectedSme(prev => (prev ? { ...prev, ...unlockedData, contactUnlocked: true, contactEmail: unlockedData.contact_email, contactPhone: unlockedData.contact_phone } : null));
          // Update store immediately, then refresh from server
          if (typeof res.data.credits_remaining === 'number') {
            updateCredits(res.data.credits_remaining);
          }
          refreshCredits();
        }
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.message;
      console.error("[UNLOCK ERROR] Status:", status, "|", detail);
      if (status === 402) {
        setShowCreditsModal(true);
      } else {
        alert(`Unlock failed: ${detail}`);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const filteredData = smeData.filter(
    (sme) =>
      sme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sme.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sme.governorate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "Low": case "Low Risk": return <ShieldCheck className="w-4 h-4 mr-1.5" />;
      case "Medium": case "Medium Risk": return <TrendingUp className="w-4 h-4 mr-1.5" />;
      case "High": case "High Risk": return <AlertTriangle className="w-4 h-4 mr-1.5" />;
      default: return null;
    }
  };

  const getTierColor = (tier: string) => {
    if (tier.toLowerCase().includes("low")) return "text-teal-400 bg-teal-400/10 border-teal-400/20";
    if (tier.toLowerCase().includes("medium")) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
    if (tier.toLowerCase().includes("high")) return "text-red-400 bg-red-400/10 border-red-400/20";
    return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  };

  return (
    <AuthGuard>
    <div className="pt-32 pb-24 min-h-screen px-6 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] -z-10" />

      {/* TASK 2: Insufficient Credits Modal */}
      {showCreditsModal && <InsufficientCreditsModal onClose={() => setShowCreditsModal(false)} />}

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Investor Marketplace</h1>
            <p className="text-gray-400">
              Discover and evaluate verified Tunisian SMEs. Contact details are available by subscription.
              {dataSource === "mock" && !isLoading && (
                <span className="ml-2 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">Demo Data</span>
              )}
              {dataSource === "live" && (
                <span className="ml-2 text-xs text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-full border border-teal-400/20">Live Profiles</span>
              )}
            </p>
          </div>


          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by company, sector, or governorate..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-white outline-none" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Company Profile</th>
                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Demographics</th>
                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Financial Risk Grade</th>
                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Computed FinScore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredData.length > 0 ? (
                    filteredData.map((sme, index) => (
                      <motion.tr key={sme.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handleSmeClick(sme)}
                        className="hover:bg-white/10 transition-colors group cursor-pointer">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            {/* Clearbit Logo — falls back to initial circle */}
                            <CompanyLogo name={sme.name} website={(sme as any).website} />
                            <div>
                              <div className="font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center">
                                {sme.name} <ExternalLink className="w-3 h-3 ms-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="text-xs text-gray-500 mt-1 font-mono">ID RNE: {sme.identifiantRne}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1.5">
                            <span className="flex items-center text-xs text-gray-300"><Building className="w-3 h-3 mr-1.5 text-gray-500" /> {sme.sector}</span>
                            <span className="flex items-center text-xs text-gray-400"><MapPin className="w-3 h-3 mr-1.5 text-gray-500" /> {sme.governorate}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1.5 font-bold text-xs rounded-full border 
                            ${sme.financialGrade === 'Grade A' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 
                              sme.financialGrade === 'Grade B' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                              'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                            {sme.financialGrade || "Masked"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-2xl font-black ${sme.riskTier.includes("Low") ? "text-teal-400" : sme.riskTier.includes("Medium") ? "text-yellow-400" : "text-red-400"}`}>
                              {sme.finScore}
                            </span>
                            <div className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full border ${getTierColor(sme.riskTier)}`}>
                              {getTierIcon(sme.riskTier)}
                              {sme.riskTier.replace("Risk", "")}
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          <Filter className="w-12 h-12 mb-4 opacity-50" />
                          <p className="text-lg font-medium text-gray-400 mb-1">No Public Profiles Found</p>
                          <p className="text-sm">Try adjusting your filters or governorate.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* LEAD GENERATION MODAL */}
      <AnimatePresence>
        {selectedSme && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedSme(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-8 border-b border-white/10 bg-white/5 relative">
                <button onClick={() => setSelectedSme(null)} className="absolute top-6 right-6 text-gray-400 hover:text-white">✕</button>
                <div className="flex items-center gap-4 mb-2">
                  <h2 className="text-3xl font-bold text-white">{selectedSme.name}</h2>
                </div>
                <div className="flex gap-4 text-sm text-gray-400">
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-indigo-400" /> {selectedSme.governorate}</span>
                  <span className="flex items-center"><Building className="w-4 h-4 mr-1 text-indigo-400" /> {selectedSme.sector}</span>
                  <span className="font-mono bg-black/30 px-2 py-0.5 rounded border border-white/5">RNE: {selectedSme.identifiantRne}</span>
                </div>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                {/* Score & Tier Header */}
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-bold">Latest FinScore</div>
                    <div className={`text-6xl font-black ${selectedSme.riskTier.includes("Low") ? "text-teal-400" : selectedSme.riskTier.includes("Medium") ? "text-yellow-400" : "text-red-400"}`}>
                      {selectedSme.finScore}
                    </div>
                  </div>
                  <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-6 flex flex-col justify-center">
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-4 font-bold">Risk Abstractions</div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Financial Grade</span>
                        <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{selectedSme.financialGrade}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-white/5 pt-3">
                        <span className="text-gray-400">Risk Severity</span>
                        <div className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded border ${getTierColor(selectedSme.riskTier)}`}>
                          {selectedSme.riskTier}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lead Gen Call to Action */}
                <div className={`rounded-2xl border p-6 flex flex-col items-center justify-center text-center transition-all
                  ${selectedSme.contactUnlocked ? 'bg-teal-500/10 border-teal-500/30' : 'bg-gradient-to-b from-indigo-900/30 to-black/50 border-indigo-500/20'}`}>
                  {selectedSme.contactUnlocked ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
                      <div className="inline-flex bg-teal-500/20 text-teal-400 p-3 rounded-full mb-4">
                        <Unlock className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-6">Contact Information Unlocked</h3>
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href={selectedSme.contactEmail ? `mailto:${selectedSme.contactEmail}` : '#'} className="flex items-center justify-center px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                          <Mail className="w-5 h-5 mr-3 text-teal-400" /> 
                          <span className="font-mono text-gray-300">{selectedSme.contactEmail || "Non renseigné"}</span>
                        </a>
                        <a href={selectedSme.contactPhone ? `tel:${selectedSme.contactPhone.replace(/\s+/g,'')}` : '#'} className="flex items-center justify-center px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                          <Phone className="w-5 h-5 mr-3 text-teal-400" /> 
                          <span className="font-mono text-gray-300">{selectedSme.contactPhone || "Non renseigné"}</span>
                        </a>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      <div className="inline-flex bg-white/5 text-gray-400 p-3 rounded-full mb-4">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">Unlock Direct Contact</h3>
                      <p className="text-sm text-gray-400 mb-6 max-w-sm">Use a Lead Credit to unlock phone & email data for {selectedSme.name}.</p>
                      <button onClick={() => unlockContact(selectedSme.id)} disabled={isUnlocking}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center transition-all disabled:opacity-50">
                        {isUnlocking ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Unlock className="w-5 h-5 mr-2" />}
                        Unlock for 1 Credit
                      </button>
                    </>
                  )}
                </div>

                {/* Similar Recommendations */}
                {similarSmes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Similar Opportunities in {selectedSme.governorate}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {similarSmes.map(sim => (
                        <div key={sim.id} onClick={() => handleSmeClick(sim)}
                          className="p-4 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all">
                          <div className="font-bold text-sm text-white mb-1">{sim.name}</div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-gray-500 font-mono">{sim.sector}</span>
                            <span className={`text-sm font-bold ${getScoreColor(sim.riskTier)}`}>{sim.finScore}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </AuthGuard>
  );
}
