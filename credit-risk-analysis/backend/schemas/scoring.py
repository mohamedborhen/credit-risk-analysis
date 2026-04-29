"""
Pydantic schemas for the scoring endpoints (/scoring/predict, /scoring/what-if).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class FinancialInput(BaseModel):
    """Input payload for credit score prediction.
    
    Matches the feature schema expected by the dual-model stacking pipeline.
    """
    # Company metadata
    company_name: str | None = Field(default=None, max_length=255)
    type_of_business: str | None = Field(
        default=None,
        description="Business sector, e.g. Services_B2C, Tech_IT_Startup, Agriculture",
    )

    # Model 1 — Financial features
    business_turnover_tnd: float = Field(..., ge=0, description="Annual turnover in TND")
    business_expenses_tnd: float = Field(..., ge=0, description="Annual expenses in TND")
    profit_margin: float | None = Field(default=None, ge=-1, le=1, description="Net profit margin ratio")
    nbr_of_workers: int = Field(default=0, ge=0, description="Total number of workers")
    workers_verified_cnss: int = Field(default=0, ge=0, description="CNSS-verified workers count")
    formal_worker_ratio: float | None = Field(default=None, ge=0, le=1, description="Ratio of formal workers")
    business_age_years: int = Field(default=0, ge=0, description="Business age in years")
    number_of_owners: int = Field(default=1, ge=1, description="Number of owners/partners")

    # Model 2 — Behavioral / compliance features
    compliance_rne_score: float = Field(default=0, ge=0, le=10, description="RNE compliance score (0-10)")
    steg_sonede_score: float = Field(default=0, ge=0, le=10, description="STEG/SONEDE utility score (0-10)")
    banking_maturity_score: float = Field(default=0, ge=0, le=10, description="Banking maturity score (0-10)")
    followers_fcb: int = Field(default=0, ge=0, description="Facebook followers count")
    followers_insta: int = Field(default=0, ge=0, description="Instagram followers count")
    followers_linkedin: int = Field(default=0, ge=0, description="LinkedIn followers count")
    posts_per_month: int = Field(default=0, ge=0, description="Average social media posts per month")


class ProbabilityDetail(BaseModel):
    model1_financial: float
    model2_behavioral: float
    stacked_final: float


class ShapFeatureDetail(BaseModel):
    feature: str
    model: str
    value: float
    shap_value: float
    description: str


class ScoreResponse(BaseModel):
    """Response from /scoring/predict and /scoring/what-if."""
    score: int = Field(..., description="FinScore (0-100)")
    risk_tier: str = Field(..., description="Low Risk / Medium Risk / High Risk")
    decision: str = Field(..., description="Approved / Manual Review / Rejected")
    decision_explanation: str
    probabilities: ProbabilityDetail
    strengths: list[ShapFeatureDetail]
    weaknesses: list[ShapFeatureDetail]
    is_simulation: bool = Field(default=False, description="True if this is a what-if simulation")
    report_id: str | None = Field(default=None, description="DB report ID (null for simulations)")
    cnss_score_grade: str | None = Field(default=None, description="Traffic light grade for CNSS")
    op_integrity_index: str | None = Field(default=None, description="Traffic light grade for Integrity")

class BankerSimulationLogInput(BaseModel):
    company_name: str
    capital: float
    score: int
    risk_tier: str
