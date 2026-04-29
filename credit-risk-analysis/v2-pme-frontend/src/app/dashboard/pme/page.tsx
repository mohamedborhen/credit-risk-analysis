"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Calculator, ShieldCheck, Zap, Activity, AlertTriangle, TrendingUp, HelpCircle, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import apiClient from "@/lib/api/axios";
import { useEffect } from "react";

interface ScoreResult {
  score: number;
  risk_tier: string;
  decision: string;
  decision_explanation: string;
  probabilities: { model1_financial: number; model2_behavioral: number; stacked_final: number };
  strengths: { feature: string; value: number; shap_value: number; description: string }[];
  weaknesses: { feature: string; value: number; shap_value: number; description: string }[];
  cnss_score_grade?: string;
  op_integrity_index?: string;
  report_id?: string;
}

export default function PMEDashboardPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  
  // Visibility States
  const [visibility, setVisibility] = useState<string>("Private");
  const [marketplaceStatus, setMarketplaceStatus] = useState<number>(0);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleFeedback, setToggleFeedback] = useState<string | null>(null);

  // Missing State Vars for handleEnrich
  const [companyNameToEnrich, setCompanyNameToEnrich] = useState("");
  const [enrichStatus, setEnrichStatus] = useState<"idle" | "loading" | "success" | "partial">("idle");
  const [enrichMissingFields, setEnrichMissingFields] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    business_turnover_tnd: "",
    business_expenses_tnd: "",
    nbr_of_workers: "",
    workers_verified_cnss: "",
    business_age_years: "",
    number_of_owners: "1",
    compliance_rne_score: 5,
    steg_sonede_score: 5,
    banking_maturity_score: 5,
    followers_fcb: "",
    followers_insta: "",
    followers_linkedin: "",
    posts_per_month: "",
    type_of_business: "Services",
  });

  // True Backend Data Persistence Instead of Local Storage
  useEffect(() => {
    const fetchLatestData = async () => {
      try {
        const res = await apiClient.get("/scoring/latest");
        if (res.data) {
          setFormData({
            business_turnover_tnd: res.data.business_turnover_tnd.toString(),
            business_expenses_tnd: res.data.business_expenses_tnd.toString(),
            nbr_of_workers: res.data.nbr_of_workers.toString(),
            workers_verified_cnss: res.data.workers_verified_cnss.toString(),
            business_age_years: res.data.business_age_years.toString(),
            number_of_owners: res.data.number_of_owners.toString(),
            compliance_rne_score: res.data.compliance_rne_score,
            steg_sonede_score: res.data.steg_sonede_score,
            banking_maturity_score: res.data.banking_maturity_score,
            followers_fcb: res.data.followers_fcb.toString(),
            followers_insta: res.data.followers_insta.toString(),
            followers_linkedin: res.data.followers_linkedin.toString(),
            posts_per_month: res.data.posts_per_month.toString(),
            type_of_business: res.data.type_of_business,
          });
        }
      } catch (err) {
        console.log("No previous data found or error fetching latest data");
      }
    };
    
    const fetchVisibility = async () => {
      try {
        const res = await apiClient.get("/marketplace/me");
        if (res.data) {
          setVisibility(res.data.visibility_status);
          setMarketplaceStatus(res.data.marketplace_status);
        }
      } catch (err) {}
    }

    fetchLatestData();
    fetchVisibility();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const turnover = parseFloat(formData.business_turnover_tnd) || 0;
      const expenses = parseFloat(formData.business_expenses_tnd) || 0;
      const totalWorkers = parseInt(formData.nbr_of_workers) || 0;
      const cnssWorkers = parseInt(formData.workers_verified_cnss) || 0;

      const payload = {
        business_turnover_tnd: turnover,
        business_expenses_tnd: expenses,
        profit_margin: turnover > 0 ? Math.max(-1, Math.min(1, (turnover - expenses) / turnover)) : 0,
        nbr_of_workers: totalWorkers,
        workers_verified_cnss: cnssWorkers,
        formal_worker_ratio: totalWorkers > 0 ? cnssWorkers / totalWorkers : 0,
        business_age_years: parseInt(formData.business_age_years) || 1,
        number_of_owners: parseInt(formData.number_of_owners) || 1,
        compliance_rne_score: formData.compliance_rne_score,
        steg_sonede_score: formData.steg_sonede_score,
        banking_maturity_score: formData.banking_maturity_score,
        followers_fcb: parseInt(formData.followers_fcb) || 0,
        followers_insta: parseInt(formData.followers_insta) || 0,
        followers_linkedin: parseInt(formData.followers_linkedin) || 0,
        posts_per_month: parseInt(formData.posts_per_month) || 0,
        type_of_business: formData.type_of_business,
      };

      const res = await apiClient.post("/scoring/predict", payload);
      setResult(res.data);
      setShowResult(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let msg: string;
      if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
      } else if (typeof detail === 'string') {
        msg = detail;
      } else if (err?.response?.status === 401) {
        msg = "Session expired. Please log out and log in again.";
      } else if (err?.response?.status === 403) {
        msg = "Access denied. Only PME accounts can submit financial data.";
      } else if (err?.response?.status === 404) {
        msg = "Profile not found. Please log out, register again, then retry.";
      } else {
        msg = err?.message || "Unknown error";
      }
      setError(`❌ Scoring failed: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePrediction = async () => {
    if (!result?.report_id) return;
    const confirmed = window.confirm("Are you sure you want to delete this prediction?");
    if (!confirmed) return;

    try {
      const res = await apiClient.delete(`/scoring/prediction/${result.report_id}`);
      if (res.data.status === "success") {
        setResult(null);
        setToggleFeedback("✅ Prediction was successfully deleted");
        setTimeout(() => setToggleFeedback(null), 3000);
      }
    } catch (err) {
      alert("Failed to delete prediction.");
    }
  };

  const shapChartData = result
    ? [
        ...(result.strengths || []).map((s) => ({ name: s.feature.replace(/_/g, " "), value: Math.abs(s.shap_value) * 100, positive: true, desc: s.description })),
        ...(result.weaknesses || []).map((w) => ({ name: w.feature.replace(/_/g, " "), value: -Math.abs(w.shap_value) * 100, positive: false, desc: w.description })),
      ]
    : [];

  const getRiskColor = (tier: string) => {
    if (tier.toLowerCase().includes("low")) return "text-teal-400 bg-teal-500/20 border-teal-500/50";
    if (tier.toLowerCase().includes("medium")) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/50";
    return "text-red-400 bg-red-500/20 border-red-500/50";
  };

  const getRiskIcon = (tier: string) => {
    if (tier.toLowerCase().includes("low")) return <ShieldCheck className="w-5 h-5" />;
    if (tier.toLowerCase().includes("medium")) return <TrendingUp className="w-5 h-5" />;
    return <AlertTriangle className="w-5 h-5" />;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 border border-white/10 p-4 rounded-xl shadow-xl max-w-xs">
          <p className="font-bold text-white capitalize mb-1">{label}</p>
          <p className="text-sm text-gray-400 mb-2">{payload[0].payload.desc}</p>
          <p className="text-xs font-mono" style={{ color: payload[0].fill }}>
            AI Weight: {payload[0].value > 0 ? '+' : ''}{payload[0].value.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const handleToggleVisibility = async (status: string) => {
    setIsToggling(true);
    setToggleFeedback(null);
    try {
      const res = await apiClient.put("/marketplace/visibility", { visibility_status: status });
      if (res.data.success) {
        setVisibility(res.data.visibility_status);
        setMarketplaceStatus(res.data.marketplace_status);
        if (status === "Public") {
          setToggleFeedback(`✅ PME ${res.data.rne_id} is now LIVE on the Tunisian Marketplace.`);
        } else {
          setToggleFeedback("Locked. Profile is now hidden from the marketplace.");
        }
        setTimeout(() => setToggleFeedback(null), 5000);
      }
    } catch (e) {
      console.warn("Failed to toggle visibility");
    } finally {
      setIsToggling(false);
    }
  };

  const handleEnrich = async () => {
    if (!companyNameToEnrich.trim()) return;
    setEnrichStatus("loading");
    try {
      const res = await apiClient.post("/enrich/company/mock", { company_name: companyNameToEnrich });
      if (res.data.status === "success") {
        const d = res.data.data;
        setFormData(prev => ({
          ...prev,
          type_of_business: d.sector || prev.type_of_business,
          followers_linkedin: String(d.linkedin_followers || ""),
        }));
        setEnrichStatus("success");
      } else {
        setEnrichMissingFields(res.data.missing_fields || []);
        setEnrichStatus("partial");
      }
    } catch {
      setEnrichStatus("partial");
      setEnrichMissingFields(["website", "employees", "sector"]);
    }
  };

  return (
    <div className="pt-24 pb-24 min-h-screen px-6 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[150px] -z-10"></div>
      
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold mb-2">Comprehensive AI Assessment</h1>
            <p className="text-gray-400">Our machine learning models use both traditional financial parameters and behavioral web-footprints.</p>
          </div>
          
          <div className="flex items-center space-x-2 bg-slate-900 border border-white/10 px-4 py-2 rounded-xl text-sm whitespace-nowrap hidden md:flex">
             {visibility === "Public" ? <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span> : <span className="w-2 h-2 rounded-full bg-gray-500"></span>}
             <span className="font-bold text-gray-300">Status: {visibility}</span>
             <span className="text-gray-500 ml-2">|</span>
             <span className="text-indigo-400 ml-2 font-mono text-xs">{marketplaceStatus === 1 ? 'Live on Market' : 'Hidden'}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.4 }}
              className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl"
            >
              {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-8">


                <div>
                  <h3 className="text-teal-400 font-bold mb-4 uppercase text-sm tracking-wider border-b border-white/10 pb-2">Module 1: Financial & Structural Data</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">Business Sector</label>
                      <select required value={formData.type_of_business} onChange={(e) => setFormData({ ...formData, type_of_business: e.target.value })}
                        className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-white outline-none">
                        <option value="Services">Services (B2B/B2C)</option>
                        <option value="Technology">Technology / IT</option>
                        <option value="Agriculture">Agriculture</option>
                        <option value="Manufacturing">Manufacturing</option>
                        <option value="Retail">Retail</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">Turnover (TND)</label>
                      <input type="number" required value={formData.business_turnover_tnd} onChange={(e) => setFormData({ ...formData, business_turnover_tnd: e.target.value })}
                        className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white outline-none" placeholder="250000" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">Expenses (TND)</label>
                      <input type="number" required value={formData.business_expenses_tnd} onChange={(e) => setFormData({ ...formData, business_expenses_tnd: e.target.value })}
                        className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white outline-none" placeholder="180000" />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">Business Age (Years)</label>
                      <input type="number" required value={formData.business_age_years} onChange={(e) => setFormData({ ...formData, business_age_years: e.target.value })}
                        className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-teal-500 text-white outline-none" placeholder="5" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">Number of Owners</label>
                      <input type="number" value={formData.number_of_owners} onChange={(e) => setFormData({ ...formData, number_of_owners: e.target.value })}
                        className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-teal-500 text-white outline-none" placeholder="1" />
                    </div>
                  </div>
                </div>

                {/* 2. EMPLOYMENT MODULE */}
                <div>
                  <h3 className="text-teal-400 font-bold mb-4 uppercase text-sm tracking-wider border-b border-white/10 pb-2">Module 2: Employment Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">Total Workers</label>
                      <input type="number" required value={formData.nbr_of_workers} onChange={(e) => setFormData({ ...formData, nbr_of_workers: e.target.value })} className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-teal-500 text-white outline-none" placeholder="e.g. 10" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">CNSS Verified Workers</label>
                      <input type="number" required value={formData.workers_verified_cnss} onChange={(e) => setFormData({ ...formData, workers_verified_cnss: e.target.value })} className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-teal-500 text-white outline-none" placeholder="e.g. 10" />
                    </div>
                  </div>
                </div>

                {/* 3. BEHAVIORAL MODULE */}
                <div>
                  <h3 className="text-indigo-400 font-bold mb-4 uppercase text-sm tracking-wider border-b border-white/10 pb-2">Module 3: Behavioral & Engagement Data</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">FB Followers</label>
                      <input type="number" value={formData.followers_fcb} onChange={(e) => setFormData({ ...formData, followers_fcb: e.target.value })} className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none" placeholder="5000" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">Insta Followers</label>
                      <input type="number" value={formData.followers_insta} onChange={(e) => setFormData({ ...formData, followers_insta: e.target.value })} className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none" placeholder="3000" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">LinkedIn Followers</label>
                      <input type="number" value={formData.followers_linkedin} onChange={(e) => setFormData({ ...formData, followers_linkedin: e.target.value })} className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none" placeholder="200" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 ml-1">Posts per month</label>
                      <input type="number" value={formData.posts_per_month} onChange={(e) => setFormData({ ...formData, posts_per_month: e.target.value })} className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none" placeholder="15" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 p-5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-medium text-gray-300">RNE Compliance</label>
                        <span className="text-indigo-400 font-bold text-xs">{formData.compliance_rne_score}/10</span>
                      </div>
                      <input type="range" min="0" max="10" step="0.5" value={formData.compliance_rne_score} onChange={(e) => setFormData({ ...formData, compliance_rne_score: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-medium text-gray-300">STEG/Utility Rating</label>
                        <span className="text-indigo-400 font-bold text-xs">{formData.steg_sonede_score}/10</span>
                      </div>
                      <input type="range" min="0" max="10" step="0.5" value={formData.steg_sonede_score} onChange={(e) => setFormData({ ...formData, steg_sonede_score: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-medium text-gray-300">Banking Maturity</label>
                        <span className="text-indigo-400 font-bold text-xs">{formData.banking_maturity_score}/10</span>
                      </div>
                      <input type="range" min="0" max="10" step="0.5" value={formData.banking_maturity_score} onChange={(e) => setFormData({ ...formData, banking_maturity_score: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isSubmitting}
                    className="w-full py-5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-500 text-white font-bold text-lg flex items-center justify-center hover:opacity-90 transition-all shadow-[0_0_20px_rgba(45,212,191,0.4)] disabled:opacity-50">
                    {isSubmitting ? (
                      <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Analyzing Complete Feature Stack...</>
                    ) : (
                      <><Calculator className="w-6 h-6 mr-3" /> 💾 SAVE PREDICTION & CALCULATE FIN-SCORE</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : result && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Top: Score & Badges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-teal-500/30 shadow-[0_0_30px_rgba(45,212,191,0.1)] flex flex-col sm:flex-row items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/20 rounded-full blur-2xl"></div>
                  <div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-teal-400 font-mono tracking-widest uppercase">Official FinScore Evaluated</div>
                      {result.report_id && (
                        <button onClick={handleDeletePrediction} title="Delete Prediction" className="p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/30">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <h2 className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] mt-2">
                      {result.score}<span className="text-2xl text-gray-500">/1000</span>
                    </h2>
                  </div>
                  <div className="mt-6 sm:mt-0 text-center sm:text-right z-10 flex flex-col items-center sm:items-end">
                    <div className={`inline-flex items-center space-x-2 px-6 py-3 rounded-full border font-bold text-lg ${getRiskColor(result.risk_tier)}`}>
                      {getRiskIcon(result.risk_tier)}
                      <span>{result.risk_tier}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-3 font-medium bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">System Decision: {result.decision}</p>
                  </div>
                </div>

                <div className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 flex flex-col justify-center gap-4">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 text-center">Model Ensembles</h4>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center text-sm text-gray-300">
                      <Activity className="w-4 h-4 mr-2 text-indigo-400" /> Module 1: Finance
                    </div>
                    <span className="font-bold text-white">{(result.probabilities.model1_financial * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center text-sm text-gray-300">
                      <Zap className="w-4 h-4 mr-2 text-yellow-400" /> Module 2: Behavior
                    </div>
                    <span className="font-bold text-white">{(result.probabilities.model2_behavioral * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center text-sm text-gray-300">
                      <ShieldCheck className="w-4 h-4 mr-2 text-teal-400" /> Stacked Verdict
                    </div>
                    <span className="font-bold text-teal-400">{(result.probabilities.stacked_final * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Traffic Lights UI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                 <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center shadow-xl">
                    <span className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">CNSS Compliance</span>
                    <span className="text-2xl font-bold bg-white/5 py-2 px-6 rounded-full border border-white/5 flex items-center justify-center whitespace-nowrap min-w-[250px]">{result.cnss_score_grade || "🟢 High Compliance"}</span>
                 </div>
                 <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center shadow-xl">
                    <span className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">Operational Integrity</span>
                    <span className="text-2xl font-bold bg-white/5 py-2 px-6 rounded-full border border-white/5 flex items-center justify-center whitespace-nowrap min-w-[250px]">{result.op_integrity_index || "🟢 High Compliance"}</span>
                 </div>
              </div>

              {/* Enhanced Explanation Box (Markdown Tables style) */}
              <div className="p-8 rounded-3xl bg-white/5 backdrop-blur border border-white/10 text-gray-200">
                <h3 className="text-xl font-bold mb-6 flex items-center text-white"><HelpCircle className="w-6 h-6 mr-2 text-indigo-400" /> Executive Summary & Model Insight</h3>
                <p className="text-lg leading-relaxed mb-8">{result.decision_explanation}</p>
                
                <h4 className="font-bold text-gray-300 uppercase tracking-wider text-sm mb-4">Positive Influences (Strengths)</h4>
                <div className="overflow-x-auto mb-8 bg-black/20 rounded-xl border border-white/5">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead><tr className="border-b border-white/10 text-teal-400 bg-teal-500/5"><th className="py-3 px-4">Feature Segment</th><th className="py-3 px-4">Detected Value</th><th className="py-3 px-4">AI Interpretation</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {result.strengths?.map(s => <tr key={s.feature} className="hover:bg-white/5"><td className="py-3 px-4 font-mono text-gray-400">{s.feature}</td><td className="py-3 px-4 font-bold">{s.value}</td><td className="py-3 px-4">{s.description}</td></tr>)}
                    </tbody>
                  </table>
                </div>

                <h4 className="font-bold text-gray-300 uppercase tracking-wider text-sm mb-4">Risk Factors (Weaknesses)</h4>
                <div className="overflow-x-auto bg-black/20 rounded-xl border border-white/5">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead><tr className="border-b border-white/10 text-red-400 bg-red-500/5"><th className="py-3 px-4">Feature Segment</th><th className="py-3 px-4">Detected Value</th><th className="py-3 px-4">AI Interpretation</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {result.weaknesses?.map(w => <tr key={w.feature} className="hover:bg-white/5"><td className="py-3 px-4 font-mono text-gray-400">{w.feature}</td><td className="py-3 px-4 font-bold">{w.value}</td><td className="py-3 px-4">{w.description}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SHAP Chart */}
              {shapChartData.length > 0 && (
                <div className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                  <div className="mb-6 flex justify-between items-end">
                    <div>
                      <h3 className="text-xl font-bold">Predictive AI Influence Matrix (SHAP)</h3>
                      <p className="text-sm text-gray-400 mt-1">Discover exactly which features shifted your application towards approval or rejection.</p>
                    </div>
                  </div>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={shapChartData} margin={{ top: 10, right: 30, left: 160, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "#cbd5e1", fontSize: 13 }} width={150} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={26}>
                          {shapChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.positive ? '#2dd4bf' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-teal-400 mr-2"></span> Positive Impact</div>
                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span> Negative Risk Impact</div>
                  </div>
                </div>
              )}
              
              {/* Marketplace Triggers */}
              <div className="p-8 rounded-3xl bg-slate-900 border border-t-indigo-500/30 border-white/10 mt-10 shadow-2xl flex flex-col items-center">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white">Marketplace Visibility Controls</h3>
                  <p className="text-gray-400 mt-2">Current Status: {visibility === 'Public' ? '🌐' : '🔒'} {visibility} | Marketplace: <span className="font-mono text-indigo-400">{marketplaceStatus === 1 ? 'Published' : 'Hidden'}</span></p>
                  
                  {toggleFeedback && (
                    <div className="mt-4 px-4 py-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-lg text-sm font-bold animate-pulse">
                      {toggleFeedback}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button onClick={() => { setShowResult(false); setResult(null); }} className="px-6 py-4 rounded-xl border border-white/20 hover:bg-white/10 transition-all text-sm font-bold text-white shadow-lg flex-1 max-w-[250px]">
                    💾 EDIT PREDICTION
                  </button>
                  
                  {visibility !== "Public" ? (
                    <button onClick={() => handleToggleVisibility("Public")} disabled={isToggling}
                      className="px-6 py-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-900 transition-all text-sm font-bold shadow-lg flex-1 max-w-[250px] flex items-center justify-center disabled:opacity-50">
                      {isToggling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "🌐 PUBLISH TO MARKETPLACE"}
                    </button>
                  ) : (
                    <button onClick={() => handleToggleVisibility("Private")} disabled={isToggling}
                      className="px-6 py-4 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all text-sm font-bold shadow-lg flex-1 max-w-[250px] flex items-center justify-center disabled:opacity-50">
                      {isToggling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "🔒 HIDE FROM MARKETPLACE"}
                    </button>
                  )}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
