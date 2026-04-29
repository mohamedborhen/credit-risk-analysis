"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Calculator, Search, Bot, TrendingUp, AlertTriangle,
  ShieldCheck, Zap, Activity, HelpCircle, Building2, Users,
  BarChart2, Globe, Lock, Save
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PieChart, Pie
} from "recharts";
import apiClient from "@/lib/api/axios";

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

const SECTORS = [
  "Services", "Technology / IT", "Agriculture", "Manufacturing",
  "Retail / Commerce", "Construction / BTP", "Tourism / Hospitality",
  "Healthcare", "Education", "Transport / Logistics", "Finance",
];

const GOVERNORATES = [
  "Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan",
  "Bizerte", "Beja", "Jendouba", "Kef", "Siliana", "Kairouan",
  "Kasserine", "Sidi Bouzid", "Sousse", "Monastir", "Mahdia",
  "Sfax", "Gafsa", "Tozeur", "Kebili", "Gabes", "Medenine", "Tataouine",
];

function getRiskColor(tier: string) {
  if (tier === "Low Risk") return "text-teal-400 border-teal-500/50 bg-teal-500/10";
  if (tier === "Medium Risk") return "text-yellow-400 border-yellow-500/50 bg-yellow-500/10";
  return "text-red-400 border-red-500/50 bg-red-500/10";
}

function getRiskIcon(tier: string) {
  if (tier === "Low Risk") return <ShieldCheck className="w-5 h-5 mr-2" />;
  if (tier === "Medium Risk") return <AlertTriangle className="w-5 h-5 mr-2" />;
  return <AlertTriangle className="w-5 h-5 mr-2" />;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-900/90 border border-white/10 p-4 rounded-xl shadow-xl max-w-xs">
        <p className="font-bold text-white capitalize mb-1">{label}</p>
        <p className="text-xs font-mono" style={{ color: payload[0].fill }}>
          AI Weight: {payload[0].value > 0 ? '+' : ''}{payload[0].value.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

export default function InvestorDashboardPage() {
  const [activeTab, setActiveTab] = useState<"manual" | "auto">("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrapingStep, setScrapingStep] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");

  // ── Enrichissement B2B (Mock + Grok AI) ──
  const [enrichQuery, setEnrichQuery] = useState("");
  const [enrichMode, setEnrichMode] = useState<"mock" | "grok">("mock");
  const [enrichStatus, setEnrichStatus] = useState<"idle" | "loading" | "success" | "partial">("idle");
  const [enrichMissingFields, setEnrichMissingFields] = useState<string[]>([]);
  const [enrichGrokResult, setEnrichGrokResult] = useState<any>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    sector: "Services",
    governorate: "Tunis",
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const turnover = parseFloat(formData.business_turnover_tnd) || 0;
    const expenses = parseFloat(formData.business_expenses_tnd) || 0;
    const totalWorkers = parseInt(formData.nbr_of_workers) || 0;
    const cnssWorkers = parseInt(formData.workers_verified_cnss) || 0;

    const payload = {
      company_name: formData.company_name,
      type_of_business: formData.type_of_business,
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
    };

    try {
      const res = await apiClient.post("/scoring/what-if", payload);
      setResult(res.data);
      setShowResult(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let msg: string;
      if (Array.isArray(detail)) msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
      else if (typeof detail === 'string') msg = detail;
      else msg = err?.message || "Unknown error";
      setError(`❌ Scoring failed: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveToLogs = async () => {
    if (!result) return;
    try {
      const payload = {
        company_name: formData.company_name || "Unknown SME",
        capital: Number(formData.business_turnover_tnd) || 0,
        score: result.score,
        risk_tier: result.risk_tier
      };
      const res = await apiClient.post("/scoring/logs", payload);
      if (res.data.status === "success") {
        window.alert("✅ Log saved!");
      }
    } catch (err: any) {
      console.error(err);
      window.alert("❌ Error: Failed to save the prediction log.");
    }
  };
  const handleAutoScrape = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const steps = [
      "🔍 Initializing Web Scraper Agent...",
      "📋 Extracting RNE registry data...",
      "💼 Analyzing LinkedIn company profile...",
      "📊 Processing alternative behavioral signals...",
      "🤖 Running dual-model FinScore pipeline...",
    ];
    let i = 0;
    setScrapingStep(steps[0]);
    const interval = setInterval(() => {
      i++;
      if (i < steps.length) {
        setScrapingStep(steps[i]);
      } else {
        clearInterval(interval);
        setIsSubmitting(false);
        // Placeholder result — scraping is coming later
        setResult({
          score: 0, risk_tier: "N/A", decision: "Pending",
          decision_explanation: "Auto-scraping will be available once the web scraper module is connected. Please use Manual Entry in the meantime.",
          probabilities: { model1_financial: 0, model2_behavioral: 0, stacked_final: 0 },
          strengths: [], weaknesses: [],
        });
        setShowResult(true);
      }
    }, 900);
  };

  const shapChartData = result
    ? [...(result.strengths || []), ...(result.weaknesses || [])].map(f => ({
        name: f.feature.replace(/_/g, " "),
        value: parseFloat((f.shap_value * 100).toFixed(1)),
        positive: f.shap_value > 0,
        desc: f.description,
      }))
    : [];

  const input = (label: string, field: keyof typeof formData, placeholder: string, type = "number") => (
    <div>
      <label className="text-xs font-medium text-gray-300 ml-1">{label}</label>
      <input
        type={type}
        value={formData[field] as string}
        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
        className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white outline-none"
        placeholder={placeholder}
      />
    </div>
  );

  const handleEnrich = async () => {
    if (!enrichQuery.trim()) return;
    setEnrichStatus("loading");
    setEnrichGrokResult(null);
    try {
      console.log(`[ENRICH] Calling /enrich/groq for '${enrichQuery}'`);
      const res = await apiClient.post("/enrich/groq", { company_name: enrichQuery });

      if (res.data.status === "success") {
        const d = res.data.data;
        
        setFormData(prev => ({
          ...prev,
          company_name: enrichQuery,
          business_turnover_tnd: d.business_turnover_tnd !== null && d.business_turnover_tnd !== undefined ? String(d.business_turnover_tnd) : prev.business_turnover_tnd,
          business_expenses_tnd: d.business_expenses_tnd !== null && d.business_expenses_tnd !== undefined ? String(d.business_expenses_tnd) : prev.business_expenses_tnd,
          nbr_of_workers: d.nbr_of_workers !== null && d.nbr_of_workers !== undefined ? String(d.nbr_of_workers) : prev.nbr_of_workers,
          workers_verified_cnss: d.workers_verified_cnss !== null && d.workers_verified_cnss !== undefined ? String(d.workers_verified_cnss) : prev.workers_verified_cnss,
          business_age_years: d.business_age_years !== null && d.business_age_years !== undefined ? String(d.business_age_years) : prev.business_age_years,
          compliance_rne_score: d.compliance_rne_score !== null && d.compliance_rne_score !== undefined ? Number(d.compliance_rne_score) : prev.compliance_rne_score,
          steg_sonede_score: d.steg_sonede_score !== null && d.steg_sonede_score !== undefined ? Number(d.steg_sonede_score) : prev.steg_sonede_score,
          banking_maturity_score: d.banking_maturity_score !== null && d.banking_maturity_score !== undefined ? Number(d.banking_maturity_score) : prev.banking_maturity_score,
          followers_fcb: d.followers_fcb !== null && d.followers_fcb !== undefined ? String(d.followers_fcb) : prev.followers_fcb,
          followers_insta: d.followers_insta !== null && d.followers_insta !== undefined ? String(d.followers_insta) : prev.followers_insta,
          followers_linkedin: d.followers_linkedin !== null && d.followers_linkedin !== undefined ? String(d.followers_linkedin) : prev.followers_linkedin,
          posts_per_month: d.posts_per_month !== null && d.posts_per_month !== undefined ? String(d.posts_per_month) : prev.posts_per_month,
        }));
        
        setEnrichGrokResult(d);
        setEnrichStatus("success");
        console.log("[ENRICH] Success:", d);
        setActiveTab("manual");
      } else {
        setEnrichStatus("partial");
      }
    } catch (err: any) {
      console.error("[ENRICH ERROR]", err?.response?.data?.detail || err?.message);
      setEnrichStatus("partial");
      window.alert("❌ Scraping failed: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="pt-24 pb-24 min-h-screen px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] -z-10" />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Banker Intelligence Portal</h1>
          <p className="text-gray-400">Full-spectrum SME credit assessment — dual-model FinScore pipeline.</p>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Banker Intelligence Portal</h1>
          <p className="text-gray-400">Full-spectrum SME credit assessment — run any company through the complete FinScore dual-model pipeline.</p>
        </div>

        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div key="form" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">

              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button onClick={() => setActiveTab("manual")} className={`flex-1 py-4 text-center font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "manual" ? "bg-white/10 text-white border-b-2 border-indigo-500" : "text-gray-500 hover:text-gray-300"}`}>
                  <Calculator className="w-4 h-4" /> Manual Entry
                </button>
                <button onClick={() => setActiveTab("auto")} className={`flex-1 py-4 text-center font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "auto" ? "bg-white/10 text-white border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-300"}`}>
                  <Bot className="w-4 h-4" /> Auto-Scrape <span className="text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded-full">Beta</span>
                </button>
              </div>

              <div className="p-8">
                {activeTab === "manual" ? (
                  <form onSubmit={handleManualSubmit} className="space-y-8">
                    {error && (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">{error}</div>
                    )}

                    {/* SECTION 1: Company Identity */}
                    <div>
                      <h3 className="text-indigo-400 font-bold mb-4 uppercase text-sm tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Section 1: Company Identity
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="text-xs font-medium text-gray-300 ml-1">Company Name</label>
                          <input type="text" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none" placeholder="e.g. Tunis Tech SARL" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-300 ml-1">Type / Sector</label>
                          <select value={formData.type_of_business} onChange={(e) => setFormData({ ...formData, type_of_business: e.target.value })}
                            className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none">
                            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-300 ml-1">Governorate</label>
                          <select value={formData.governorate} onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                            className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none">
                            {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-300 ml-1">Business Age (Years)</label>
                          <input type="number" required value={formData.business_age_years} onChange={(e) => setFormData({ ...formData, business_age_years: e.target.value })}
                            className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none" placeholder="e.g. 5" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-300 ml-1">Number of Owners</label>
                          <input type="number" value={formData.number_of_owners} onChange={(e) => setFormData({ ...formData, number_of_owners: e.target.value })}
                            className="w-full px-4 py-3 mt-1 rounded-xl bg-slate-900/50 border border-white/10 focus:border-indigo-500 text-white outline-none" placeholder="1" />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: Financial Data */}
                    <div>
                      <h3 className="text-teal-400 font-bold mb-4 uppercase text-sm tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" /> Section 2: Financial Profile (TND)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {input("Annual Turnover (TND)", "business_turnover_tnd", "e.g. 500000")}
                        {input("Annual Expenses (TND)", "business_expenses_tnd", "e.g. 300000")}
                      </div>
                      <p className="text-xs text-gray-500 mt-2 ml-1">Profit margin is automatically calculated from turnover and expenses.</p>
                    </div>

                    {/* SECTION 3: Employment / CNSS */}
                    <div>
                      <h3 className="text-yellow-400 font-bold mb-4 uppercase text-sm tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Section 3: Employment & CNSS Compliance
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {input("Total Workers", "nbr_of_workers", "e.g. 15")}
                        {input("CNSS-Verified Workers", "workers_verified_cnss", "e.g. 12")}
                      </div>
                      <p className="text-xs text-gray-500 mt-2 ml-1">Formal worker ratio is auto-calculated. Higher ratio → better CNSS compliance score.</p>
                    </div>

                    {/* SECTION 4: Compliance Scores */}
                    <div>
                      <h3 className="text-purple-400 font-bold mb-4 uppercase text-sm tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Section 4: Regulatory Compliance Scores
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 rounded-2xl bg-white/5 border border-white/10">
                        {[
                          { label: "RNE Compliance Score", key: "compliance_rne_score" as const, color: "purple" },
                          { label: "STEG/SONEDE Rating", key: "steg_sonede_score" as const, color: "cyan" },
                          { label: "Banking Maturity Score", key: "banking_maturity_score" as const, color: "indigo" },
                        ].map(({ label, key, color }) => (
                          <div key={key} className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                              <label className="text-xs font-medium text-gray-300">{label}</label>
                              <span className={`text-${color}-400 font-bold text-xs`}>{formData[key]}/10</span>
                            </div>
                            <input type="range" min="0" max="10" step="0.5" value={formData[key]}
                              onChange={(e) => setFormData({ ...formData, [key]: parseFloat(e.target.value) })}
                              className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-${color}-500`} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SECTION 5: Social / Behavioral */}
                    <div>
                      <h3 className="text-green-400 font-bold mb-4 uppercase text-sm tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Section 5: Digital & Behavioral Footprint
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        {input("Facebook Followers", "followers_fcb", "e.g. 5000")}
                        {input("Instagram Followers", "followers_insta", "e.g. 3000")}
                        {input("LinkedIn Followers", "followers_linkedin", "e.g. 500")}
                        {input("Posts / Month", "posts_per_month", "e.g. 12")}
                      </div>
                    </div>

                    <button type="submit" disabled={isSubmitting || !formData.company_name || !formData.business_turnover_tnd || !formData.business_expenses_tnd || !formData.business_age_years}
                      className="w-full py-5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-lg flex items-center justify-center hover:opacity-90 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:opacity-50 mt-2">
                      {isSubmitting ? <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Running Full FinScore Analysis...</> : <><Calculator className="w-6 h-6 mr-3" /> Run Full Dual-Model FinScore</>}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm flex gap-3 items-start">
                      <Bot className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <span>Groq AI will crawl available data and auto-fill the FinScore assessment form below. Any missing data must be filled manually.</span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300 ml-1">Target Company Name</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" value={enrichQuery} onChange={(e) => setEnrichQuery(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-900/50 border border-white/10 focus:border-teal-500 text-white outline-none"
                          placeholder="e.g. Poulina Group" />
                      </div>
                    </div>
                    <button type="button" onClick={handleEnrich} disabled={enrichStatus === "loading"}
                      className="w-full py-4 rounded-xl bg-teal-500 text-slate-950 font-bold flex items-center justify-center hover:bg-teal-400 transition-all disabled:opacity-50 relative overflow-hidden">
                      {enrichStatus === "loading" ? (
                        <div className="flex items-center gap-3 font-mono text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Scraping via Groq...</span>
                        </div>
                      ) : (
                        <><Bot className="mr-2 w-5 h-5" /> Scrape via Groq</>
                      )}
                    </button>
                    {enrichStatus === "partial" && (
                      <p className="text-red-400 text-sm font-medium text-center">Failed to extract complete data. Missing fields must be filled manually.</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : result && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

              {/* Score Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-teal-500/20 shadow-[0_0_30px_rgba(45,212,191,0.08)] flex flex-col sm:flex-row items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
                  <div>
                    <div className="text-sm text-indigo-400 font-mono tracking-widest mb-2 uppercase">
                      {formData.company_name || "SME"} — FinScore Assessment
                    </div>
                    <h2 className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                      {result.score}<span className="text-2xl text-gray-500">/1000</span>
                    </h2>
                  </div>
                  <div className="mt-6 sm:mt-0 z-10 flex flex-col items-center sm:items-end gap-3">
                    <div className={`inline-flex items-center px-6 py-3 rounded-full border font-bold text-lg ${getRiskColor(result.risk_tier)}`}>
                      {getRiskIcon(result.risk_tier)}<span>{result.risk_tier}</span>
                    </div>
                    <p className="text-sm text-gray-300 font-medium bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                      Decision: {result.decision}
                    </p>
                    {/* The Save Prediction Button — now fully visible to Bankers running mock simulations */}
                    <button 
                      onClick={handleSaveToLogs}
                      className="mt-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save Prediction
                    </button>
                  </div>
                </div>

                <div className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 flex flex-col justify-center gap-4">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center">Model Ensembles</h4>
                  {[
                    { label: "Financial Model", val: result.probabilities.model1_financial, icon: <Activity className="w-4 h-4 mr-2 text-indigo-400" /> },
                    { label: "Behavioral Model", val: result.probabilities.model2_behavioral, icon: <Zap className="w-4 h-4 mr-2 text-yellow-400" /> },
                    { label: "Stacked Verdict", val: result.probabilities.stacked_final, icon: <ShieldCheck className="w-4 h-4 mr-2 text-teal-400" /> },
                  ].map(({ label, val, icon }) => (
                    <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                      <div className="flex items-center text-sm text-gray-300">{icon}{label}</div>
                      <span className="font-bold text-white">{(val * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Traffic Lights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center shadow-xl">
                  <span className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">CNSS Compliance</span>
                  <span className="text-2xl font-bold bg-white/5 py-2 px-6 rounded-full border border-white/5 min-w-[250px] text-center">{result.cnss_score_grade || "—"}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center shadow-xl">
                  <span className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">Operational Integrity</span>
                  <span className="text-2xl font-bold bg-white/5 py-2 px-6 rounded-full border border-white/5 min-w-[250px] text-center">{result.op_integrity_index || "—"}</span>
                </div>
              </div>

              {/* Explanation + Tables */}
              <div className="p-8 rounded-3xl bg-white/5 backdrop-blur border border-white/10 text-gray-200">
                <h3 className="text-xl font-bold mb-6 flex items-center text-white"><HelpCircle className="w-6 h-6 mr-2 text-indigo-400" /> Executive Credit Summary</h3>
                <p className="text-lg leading-relaxed mb-8">{result.decision_explanation}</p>

                {result.strengths?.length > 0 && <>
                  <h4 className="font-bold text-gray-300 uppercase tracking-wider text-sm mb-4">Positive Influences (Strengths)</h4>
                  <div className="overflow-x-auto mb-8 bg-black/20 rounded-xl border border-white/5">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="border-b border-white/10 text-teal-400 bg-teal-500/5"><th className="py-3 px-4">Feature</th><th className="py-3 px-4">Value</th><th className="py-3 px-4">Interpretation</th></tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {result.strengths.map(s => <tr key={s.feature} className="hover:bg-white/5"><td className="py-3 px-4 font-mono text-gray-400 text-xs">{s.feature}</td><td className="py-3 px-4 font-bold">{s.value}</td><td className="py-3 px-4">{s.description}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </>}

                {result.weaknesses?.length > 0 && <>
                  <h4 className="font-bold text-gray-300 uppercase tracking-wider text-sm mb-4">Risk Factors (Weaknesses)</h4>
                  <div className="overflow-x-auto bg-black/20 rounded-xl border border-white/5">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="border-b border-white/10 text-red-400 bg-red-500/5"><th className="py-3 px-4">Feature</th><th className="py-3 px-4">Value</th><th className="py-3 px-4">Interpretation</th></tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {result.weaknesses.map(w => <tr key={w.feature} className="hover:bg-white/5"><td className="py-3 px-4 font-mono text-gray-400 text-xs">{w.feature}</td><td className="py-3 px-4 font-bold">{w.value}</td><td className="py-3 px-4">{w.description}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </>}
              </div>

              {/* SHAP Chart */}
              {shapChartData.length > 0 && (
                <div className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                  <h3 className="text-xl font-bold mb-2">Predictive AI Influence Matrix (SHAP)</h3>
                  <p className="text-sm text-gray-400 mb-6">Feature contributions that shifted this SME towards approval or rejection.</p>
                  <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={shapChartData} margin={{ top: 10, right: 30, left: 160, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "#cbd5e1", fontSize: 12 }} width={150} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                          {shapChartData.map((entry, i) => <Cell key={i} fill={entry.positive ? '#2dd4bf' : '#ef4444'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-teal-400 mr-2" /> Positive Impact</div>
                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2" /> Risk Factor</div>
                  </div>
                </div>
              )}

              {/* Action Footer */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <button onClick={() => { setShowResult(false); setResult(null); setError(null); }}
                  className="px-8 py-4 rounded-xl border border-white/20 hover:bg-white/10 text-sm font-bold text-white transition-all">
                  🔄 New Assessment
                </button>
                <button className="px-8 py-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                  <TrendingUp className="w-4 h-4" /> Add to Watchlist
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
