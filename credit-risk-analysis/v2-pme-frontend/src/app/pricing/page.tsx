"use client";

import { motion } from "framer-motion";
import { Check, Zap, Crown, Rocket, Mail, ArrowLeft, Coins, ShieldCheck } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";

const PLANS = [
  {
    name: "Starter",
    credits: 10,
    price: "29",
    currency: "TND",
    icon: Zap,
    color: "teal",
    popular: false,
    features: [
      "10 Contact Unlocks",
      "Basic FinScore Access",
      "Email & Phone Data",
      "Standard Support",
    ],
  },
  {
    name: "Pro",
    credits: 50,
    price: "99",
    currency: "TND",
    icon: Crown,
    color: "indigo",
    popular: true,
    features: [
      "50 Contact Unlocks",
      "Full FinScore Analytics",
      "Email, Phone & RNE Data",
      "Priority Support",
      "Dual-Model Risk Forecasting",
    ],
  },
  {
    name: "Enterprise",
    credits: 200,
    price: "299",
    currency: "TND",
    icon: Rocket,
    color: "purple",
    popular: false,
    features: [
      "200 Contact Unlocks",
      "Complete Platform Access",
      "Dedicated Account Manager",
      "Custom Integrations & API",
      "Enterprise SLA Support",
      "Bulk Export & Analytics",
    ],
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string; badge: string }> = {
  teal: {
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
    text: "text-teal-400",
    glow: "shadow-[0_0_40px_rgba(45,212,191,0.15)]",
    badge: "bg-teal-500",
  },
  indigo: {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    text: "text-indigo-400",
    glow: "shadow-[0_0_60px_rgba(99,102,241,0.2)]",
    badge: "bg-indigo-500",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
    glow: "shadow-[0_0_40px_rgba(168,85,247,0.15)]",
    badge: "bg-purple-500",
  },
};

export default function PricingPage() {
  return (
    <AuthGuard>
      <div className="pt-32 pb-24 min-h-screen px-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-indigo-500/8 rounded-full blur-[180px] -z-10" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[120px] -z-10" />

        <div className="max-w-6xl mx-auto">
          {/* Back link */}
          <Link
            href="/marketplace"
            className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Marketplace
          </Link>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
              <Coins className="w-4 h-4" />
              Recharge Your Credits
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">
              Choose Your{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-indigo-400 to-purple-400">
                Plan
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Unlock contact details for verified Tunisian SMEs.
              Each credit = full access to a company's contact information.
            </p>
          </motion.div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {PLANS.map((plan, index) => {
              const c = colorMap[plan.color];
              const Icon = plan.icon;
              return (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative rounded-3xl bg-white/5 backdrop-blur-xl border ${
                    plan.popular ? c.border + " " + c.glow : "border-white/10"
                  } p-8 flex flex-col ${
                    plan.popular ? "md:scale-105 md:-my-2" : ""
                  } hover:border-white/20 transition-all duration-300`}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${c.badge} text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider`}>
                      Most Popular
                    </div>
                  )}

                  {/* Icon + Name */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${c.text}`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Plan</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-white">{plan.price}</span>
                      <span className="text-lg text-gray-500 font-medium">{plan.currency}</span>
                    </div>
                    <p className={`text-sm font-bold ${c.text} mt-1`}>
                      {plan.credits} credits included
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/10 mb-6" />

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start text-sm text-gray-300">
                        <Check className={`w-4 h-4 ${c.text} mr-3 mt-0.5 shrink-0`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <a
                    href={`mailto:admin@finscore.tn?subject=Credit Recharge Request — ${plan.name} (${plan.credits} credits)&body=Hello,%0A%0AI would like to purchase the ${plan.name} pack (${plan.credits} credits) for my FinScore account.%0A%0AThank you.`}
                    className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center ${
                      plan.popular
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                        : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Administrator
                  </a>
                </motion.div>
              );
            })}
          </div>

          {/* Trust bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16 text-center"
          >
            <div className="inline-flex items-center gap-6 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <span>Secure Payment</span>
              </div>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-indigo-400" />
                <span>Instant Credits</span>
              </div>
              <div className="w-px h-5 bg-white/10" />
              <span>24/7 Support</span>
            </div>
          </motion.div>
        </div>
      </div>
    </AuthGuard>
  );
}
