"""
Pydantic schemas for the marketplace endpoint (/marketplace/browse).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MarketplaceListing(BaseModel):
    """A single PME profile visible on the investor marketplace."""
    company_name: str
    sector: str | None = None
    governorate: str | None = None
    identifiant_unique_rne: str | None = None
    marketplace_status: int = 1
    
    # Financial grade masking instead of raw sensitive numbers
    financial_grade: str | None = Field(default="Grade Unknown", description="Abstracted turnover/debt tier")
    
    latest_fin_score: int | None = Field(default=None, description="Most recent FinScore (0-1000)")
    latest_risk_tier: str | None = Field(default=None, description="Most recent risk tier")
    
    contact_unlocked: bool = False
    profile_id: str


class MarketplaceBrowseResponse(BaseModel):
    """Response for GET /marketplace/browse."""
    total: int
    listings: list[MarketplaceListing]
