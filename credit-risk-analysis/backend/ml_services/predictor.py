"""
FinScore PME — Rule-Based Scoring Engine
-----------------------------------------
A deterministic scoring pipeline that produces a REAL, dynamic score
from submitted financial and behavioral features.

Scoring Architecture (mirrors the dual-model stacking concept):
  - Model 1 (Financial):  profit margin, turnover size, business age, ownership
  - Model 2 (Behavioral): CNSS ratio, compliance scores, social media presence
  - Stacked output:       weighted combination → 0–1000 FinScore
"""

from typing import Any, Dict
import math


# ---------------------------------------------------------------------------
# Scoring weights for each feature
# ---------------------------------------------------------------------------
WEIGHTS = {
    # Financial features (Model 1) — total weight ~55%
    "profit_margin":         0.18,
    "business_turnover_tnd": 0.12,
    "business_age_years":    0.10,
    "number_of_owners":      0.05,
    "business_expenses_tnd": 0.10,   # inversely scored

    # Behavioral features (Model 2) — total weight ~45%
    "formal_worker_ratio":   0.15,
    "compliance_rne_score":  0.10,
    "steg_sonede_score":     0.08,
    "banking_maturity_score":0.07,
    "social_footprint":      0.05,   # composite followers+posts
}


def _clamp(val: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, val))


def _score_turnover(turnover: float) -> float:
    """Logarithmically scale turnover (0–∞ TND) → 0–1."""
    if turnover <= 0:
        return 0.0
    # 1M TND ≈ perfect score
    return _clamp(math.log1p(turnover) / math.log1p(1_000_000))


def _score_expenses(expenses: float, turnover: float) -> float:
    """Lower expense-to-turnover ratio is better. Inverted."""
    if turnover <= 0:
        return 0.5
    ratio = expenses / turnover
    return _clamp(1.0 - ratio)


def _score_age(age_years: int) -> float:
    """Older businesses are more stable; caps at 10 years."""
    return _clamp(age_years / 10.0)


def _score_owners(owners: int) -> float:
    """Optimal 1–3 owners; more than 5 slightly dilutes accountability."""
    if owners <= 0:
        return 0.0
    if owners <= 3:
        return 1.0
    return _clamp(1.0 - (owners - 3) * 0.1)


def _score_social(fcb: int, insta: int, linkedin: int, posts: int) -> float:
    """Composite digital footprint signal."""
    total_followers = fcb + insta + linkedin
    follower_score = _clamp(math.log1p(total_followers) / math.log1p(50_000))
    post_score = _clamp(posts / 30.0)
    return (follower_score * 0.6) + (post_score * 0.4)


def _classify_score(score: int) -> tuple[str, str, str]:
    """Return (risk_tier, decision, explanation) based on score 0-1000."""
    if score >= 750:
        return (
            "Low Risk",
            "Approved",
            f"FinScore of {score}/1000 indicates strong financial health and regulatory compliance. "
            "The company demonstrates solid revenue generation, formal employment structure, and positive behavioral signals. "
            "Credit recommendation: Eligible for full financing package."
        )
    elif score >= 550:
        return (
            "Medium Risk",
            "Manual Review",
            f"FinScore of {score}/1000 indicates moderate creditworthiness. "
            "Some financial or compliance indicators show room for improvement. "
            "Credit recommendation: Require additional documentation before approval."
        )
    else:
        return (
            "High Risk",
            "Rejected",
            f"FinScore of {score}/1000 indicates elevated credit risk. "
            "Key deficiencies detected in formal employment ratio, financial performance, or regulatory compliance. "
            "Credit recommendation: Application requires significant restructuring before reconsideration."
        )


def _build_shap_features(features: Dict[str, Any], component_scores: Dict[str, float]) -> tuple[list, list]:
    """Build ranked strengths and weaknesses from component scores."""
    all_features = []

    labels = {
        "profit_margin":         ("Profit Margin",          "Model 1", "High margin indicates strong profitability and efficient cost management." if component_scores.get("profit_margin", 0) > 0.5 else "Low profit margin reduces financial resilience."),
        "business_turnover_tnd": ("Business Turnover (TND)", "Model 1", "Strong revenue base supports loan serviceability." if component_scores.get("business_turnover_tnd", 0) > 0.5 else "Low turnover limits financial bandwidth."),
        "business_age_years":    ("Business Age (Years)",   "Model 1", "Established business history reduces uncertainty." if component_scores.get("business_age_years", 0) > 0.5 else "Young business increases default probability."),
        "number_of_owners":      ("Ownership Structure",    "Model 1", "Clear ownership structure supports governance." if component_scores.get("number_of_owners", 0) > 0.5 else "Complex ownership may dilute accountability."),
        "business_expenses_tnd": ("Expense Efficiency",     "Model 1", "Efficient operations maintain healthy margins." if component_scores.get("business_expenses_tnd", 0) > 0.5 else "High expenses relative to revenue compress margins."),
        "formal_worker_ratio":   ("CNSS Worker Ratio",      "Model 2", "High formalization rate demonstrates social compliance." if component_scores.get("formal_worker_ratio", 0) > 0.5 else "Low formal worker ratio is a major regulatory risk."),
        "compliance_rne_score":  ("RNE Compliance Score",   "Model 2", "Strong RNE record indicates regulatory adherence." if component_scores.get("compliance_rne_score", 0) > 0.5 else "Weak RNE compliance signals potential legal exposure."),
        "steg_sonede_score":     ("STEG/SONEDE Rating",     "Model 2", "Good utility payment history reflects operational discipline." if component_scores.get("steg_sonede_score", 0) > 0.5 else "Utility payment issues may indicate liquidity strain."),
        "banking_maturity_score":("Banking Maturity",       "Model 2", "Established banking relationship lowers financing risk." if component_scores.get("banking_maturity_score", 0) > 0.5 else "Limited banking history increases credit uncertainty."),
        "social_footprint":      ("Digital Presence",       "Model 2", "Strong social presence signals market visibility." if component_scores.get("social_footprint", 0) > 0.5 else "Weak digital footprint may limit market reach."),
    }

    for key, (label, model, description) in labels.items():
        raw_val = features.get(key, 0) or 0
        score = component_scores.get(key, 0)
        shap = round((score - 0.5) * 0.3, 3)
        all_features.append({
            "feature": label,
            "model": model,
            "value": round(float(raw_val), 3),
            "shap_value": shap,
            "description": description
        })

    strengths = sorted([f for f in all_features if f["shap_value"] > 0], key=lambda x: -x["shap_value"])[:4]
    weaknesses = sorted([f for f in all_features if f["shap_value"] <= 0], key=lambda x: x["shap_value"])[:4]
    return strengths, weaknesses


class ModelLoader:
    def __init__(self) -> None:
        self.is_loaded: bool = False

    def load(self, models_dir: str | None = None) -> None:
        self.is_loaded = True

    def predict(self, features: Dict[str, Any], top_n: int = 5) -> Dict[str, Any]:
        if not self.is_loaded:
            raise RuntimeError("ML models are not loaded. Cannot make predictions.")

        # ── Extract features ──────────────────────────────────────────────
        turnover    = float(features.get("business_turnover_tnd") or 0)
        expenses    = float(features.get("business_expenses_tnd") or 0)
        profit_m    = float(features.get("profit_margin") or (((turnover - expenses) / turnover) if turnover > 0 else 0))
        n_workers   = int(features.get("nbr_of_workers") or 0)
        cnss_workers= int(features.get("workers_verified_cnss") or 0)
        fwr         = float(features.get("formal_worker_ratio") or (cnss_workers / n_workers if n_workers > 0 else 0))
        age         = int(features.get("business_age_years") or 0)
        owners      = int(features.get("number_of_owners") or 1)
        rne         = float(features.get("compliance_rne_score") or 0)
        steg        = float(features.get("steg_sonede_score") or 0)
        bank        = float(features.get("banking_maturity_score") or 0)
        fcb         = int(features.get("followers_fcb") or 0)
        insta       = int(features.get("followers_insta") or 0)
        linkedin    = int(features.get("followers_linkedin") or 0)
        posts       = int(features.get("posts_per_month") or 0)

        # ── Score each component ──────────────────────────────────────────
        component_scores = {
            "profit_margin":          _clamp((profit_m + 1) / 2),          # map [-1,1] → [0,1]
            "business_turnover_tnd":  _score_turnover(turnover),
            "business_expenses_tnd":  _score_expenses(expenses, turnover),
            "business_age_years":     _score_age(age),
            "number_of_owners":       _score_owners(owners),
            "formal_worker_ratio":    _clamp(fwr),
            "compliance_rne_score":   _clamp(rne / 10.0),
            "steg_sonede_score":      _clamp(steg / 10.0),
            "banking_maturity_score": _clamp(bank / 10.0),
            "social_footprint":       _score_social(fcb, insta, linkedin, posts),
        }

        # ── Weighted totals ───────────────────────────────────────────────
        model1_raw = (
            component_scores["profit_margin"]          * WEIGHTS["profit_margin"] +
            component_scores["business_turnover_tnd"]  * WEIGHTS["business_turnover_tnd"] +
            component_scores["business_age_years"]     * WEIGHTS["business_age_years"] +
            component_scores["number_of_owners"]       * WEIGHTS["number_of_owners"] +
            component_scores["business_expenses_tnd"]  * WEIGHTS["business_expenses_tnd"]
        ) / sum(v for k, v in WEIGHTS.items() if k in ["profit_margin","business_turnover_tnd","business_age_years","number_of_owners","business_expenses_tnd"])

        model2_raw = (
            component_scores["formal_worker_ratio"]    * WEIGHTS["formal_worker_ratio"] +
            component_scores["compliance_rne_score"]   * WEIGHTS["compliance_rne_score"] +
            component_scores["steg_sonede_score"]      * WEIGHTS["steg_sonede_score"] +
            component_scores["banking_maturity_score"] * WEIGHTS["banking_maturity_score"] +
            component_scores["social_footprint"]       * WEIGHTS["social_footprint"]
        ) / sum(v for k, v in WEIGHTS.items() if k in ["formal_worker_ratio","compliance_rne_score","steg_sonede_score","banking_maturity_score","social_footprint"])

        # Stack: 55% financial, 45% behavioral
        stacked = (model1_raw * 0.55) + (model2_raw * 0.45)

        fin_score = round(_clamp(stacked) * 1000)
        risk_tier, decision, explanation = _classify_score(fin_score)

        strengths, weaknesses = _build_shap_features(
            {**features, "social_footprint": (fcb + insta + linkedin)},
            component_scores
        )

        return {
            "score": fin_score,
            "risk_tier": risk_tier,
            "decision": decision,
            "decision_explanation": explanation,
            "probabilities": {
                "model1_financial":  round(model1_raw, 4),
                "model2_behavioral": round(model2_raw, 4),
                "stacked_final":     round(stacked, 4),
            },
            "strengths":  strengths,
            "weaknesses": weaknesses,
            "shap_explanations": component_scores,
        }


model_loader = ModelLoader()
