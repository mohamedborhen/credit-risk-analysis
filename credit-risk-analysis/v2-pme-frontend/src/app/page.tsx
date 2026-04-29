"use client";

import { motion } from "framer-motion";
import { Cpu, LineChart, Sliders, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="pt-24 min-h-screen">
      {/* 1. HERO SECTION */}
      <section className="relative px-6 py-20 md:py-32 overflow-hidden bg-slate-950">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] -z-10"></div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Headline and CTAs */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
              Redefining Credit for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-500">
                Tunisian SMEs
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-lg leading-relaxed">
              Connect your alternative data to unlock instant, fair, and transparent financing. 
              Powered by our proprietary Dual-Model AI engine.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/register" 
                className="px-8 py-4 rounded-xl bg-teal-500 text-slate-950 font-bold flex items-center justify-center hover:bg-teal-400 transition-all shadow-[0_0_20px_rgba(45,212,191,0.3)] hover:shadow-[0_0_30px_rgba(45,212,191,0.5)] active:scale-95 group"
              >
                Get Started <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="#features" 
                className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 backdrop-blur-md"
              >
                Learn More
              </Link>
            </div>
          </motion.div>

          {/* Floating UI Matrix Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="hidden lg:block relative"
          >
            <motion.div
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-indigo-500"></div>
              
              <div className="flex justify-between items-center mb-8">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                </div>
                <div className="text-xs font-mono text-gray-400">FINSCORE_V2.0</div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm text-gray-400 uppercase tracking-widest font-bold">Credit Matrix Score</span>
                    <span className="text-4xl font-black text-teal-400 transition-all duration-500 drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]">780</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "78%" }}
                      transition={{ duration: 2, delay: 1 }}
                      className="h-full bg-gradient-to-r from-teal-400 to-indigo-500"
                    ></motion.div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <ShieldCheck className="text-teal-400 mb-2 w-5 h-5" />
                    <div className="text-xs text-gray-400">Risk Tier</div>
                    <div className="text-sm font-bold">Low Risk</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <Zap className="text-indigo-400 mb-2 w-5 h-5" />
                    <div className="text-xs text-gray-400">Decision</div>
                    <div className="text-sm font-bold">Approved</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 2. BENTO BOX GRID FEATURES */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24 pb-48">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Precision Intelligence</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Alternative credit scoring designed for the modern Tunisian economic ecosystem.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            whileHover={{ y: -5 }}
            className="md:col-span-2 bg-white/5 backdrop-blur border border-white/10 p-8 rounded-2xl relative overflow-hidden group transition-all"
          >
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl group-hover:bg-teal-500/20 transition-all"></div>
            <Cpu className="h-12 w-12 text-teal-400 mb-6 drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
            <h3 className="text-2xl font-bold mb-3 text-white">Dual-Model Stacking</h3>
            <p className="text-gray-400 leading-relaxed max-w-md">
              A high-performance pipeline combining Gradient Boosting and Random Forests, 
              managed by a meta-model for unprecedented scoring accuracy.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -5 }}
            className="bg-white/5 backdrop-blur border border-white/10 p-8 rounded-2xl relative overflow-hidden group transition-all"
          >
            <LineChart className="h-12 w-12 text-teal-400 mb-6 drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
            <h3 className="text-2xl font-bold mb-3 text-white">SHAP Explainability</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              Total transparency in every score. Understand exactly which financial 
              and behavioral drivers impact your rating.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -5 }}
            className="bg-white/5 backdrop-blur border border-white/10 p-8 rounded-2xl relative overflow-hidden group transition-all"
          >
            <Sliders className="h-12 w-12 text-teal-400 mb-6 drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
            <h3 className="text-2xl font-bold mb-3 text-white">What-If Simulator</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              Model future scenarios and optimize your profile before applying. 
              Real-time feedback on your business decisions.
            </p>
          </motion.div>

          {/* Extra CTA for bento look */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="md:col-span-2 bg-gradient-to-br from-teal-500/20 to-indigo-500/20 border border-teal-500/30 p-8 rounded-2xl flex flex-col items-center justify-center text-center backdrop-blur"
          >
            <h3 className="text-2xl font-bold mb-4">Unlock your business potential</h3>
            <Link 
              href="/register" 
              className="px-10 py-4 rounded-xl bg-white text-slate-950 font-bold hover:bg-gray-200 transition-all active:scale-95 shadow-xl"
            >
              Initialize FinScore Profile
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
