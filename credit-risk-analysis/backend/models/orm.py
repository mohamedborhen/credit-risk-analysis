"""
ORM models for FinScore PME.

Tables:
  - users            : Authentication & role management
  - pme_profiles     : SME company information
  - financial_data   : Per-submission financial & behavioral features
  - score_reports    : ML scoring results with SHAP explanations
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import relationship

from core.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class UserRole(str, enum.Enum):
    PME = "PME"
    BANK = "BANK"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.PME)
    credits = Column(Integer, default=5, nullable=False)  # TASK 2: credit wallet
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    pme_profile = relationship("PMEProfile", back_populates="user", uselist=False)


# ---------------------------------------------------------------------------
# PME Profile
# ---------------------------------------------------------------------------
class PMEProfile(Base):
    __tablename__ = "pme_profiles"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    company_name = Column(String(255), nullable=False)
    identifiant_unique_rne = Column(String(100), nullable=True, index=True)  # unique removed: NULL != NULL in SQLite
    sector = Column(String(100), nullable=True)
    governorate = Column(String(100), nullable=True)
    
    visibility_status = Column(String(50), default="Private")  # Private or Public
    marketplace_status = Column(Integer, default=0)            # 0: Draft, 1: Published, 2: Featured
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="pme_profile")
    financial_data = relationship("FinancialData", back_populates="pme_profile", order_by="FinancialData.created_at.desc()")
    score_reports = relationship("ScoreReport", back_populates="pme_profile", order_by="ScoreReport.created_at.desc()")


# ---------------------------------------------------------------------------
# Financial Data
# ---------------------------------------------------------------------------
class FinancialData(Base):
    __tablename__ = "financial_data"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pme_profile_id = Column(Uuid(as_uuid=True), ForeignKey("pme_profiles.id", ondelete="CASCADE"), nullable=False)

    # Financial features (Model 1)
    business_turnover_tnd = Column(Float, nullable=False)
    business_expenses_tnd = Column(Float, nullable=False)
    profit_margin = Column(Float, nullable=True)
    nbr_of_workers = Column(Integer, nullable=False, default=0)
    workers_verified_cnss = Column(Integer, nullable=False, default=0)
    formal_worker_ratio = Column(Float, nullable=True, default=0.0)
    business_age_years = Column(Integer, nullable=False, default=0)
    number_of_owners = Column(Integer, nullable=False, default=1)

    # Behavioral features (Model 2)
    compliance_rne_score = Column(Float, nullable=True)
    steg_sonede_score = Column(Float, nullable=True)
    banking_maturity_score = Column(Float, nullable=True)
    followers_fcb = Column(Integer, nullable=True, default=0)
    followers_insta = Column(Integer, nullable=True, default=0)
    followers_linkedin = Column(Integer, nullable=True, default=0)
    posts_per_month = Column(Integer, nullable=True, default=0)
    type_of_business = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    pme_profile = relationship("PMEProfile", back_populates="financial_data")
    score_report = relationship("ScoreReport", back_populates="financial_data", uselist=False)


# ---------------------------------------------------------------------------
# Score Report
# ---------------------------------------------------------------------------
class ScoreReport(Base):
    __tablename__ = "score_reports"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    financial_data_id = Column(Uuid(as_uuid=True), ForeignKey("financial_data.id", ondelete="CASCADE"), nullable=False)
    pme_profile_id = Column(Uuid(as_uuid=True), ForeignKey("pme_profiles.id", ondelete="CASCADE"), nullable=False)

    fin_score = Column(Integer, nullable=False)
    risk_tier = Column(String(50), nullable=False)
    decision = Column(String(100), nullable=True)
    decision_explanation = Column(Text, nullable=True)
    shap_explanations_json = Column(Text, nullable=True)  # JSON string of strengths/weaknesses
    
    # Persisted calculated indices for traffic-light reporting UI
    cnss_score_grade = Column(String(20), nullable=True)     # High Compliance, Minor Issues, High Risk
    op_integrity_index = Column(String(20), nullable=True)   # Derived from RNE/STEG metrics

    model1_probability = Column(Float, nullable=True)
    model2_probability = Column(Float, nullable=True)
    stacked_probability = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    financial_data = relationship("FinancialData", back_populates="score_report")
    pme_profile = relationship("PMEProfile", back_populates="score_reports")


# ---------------------------------------------------------------------------
# Wishlist
# ---------------------------------------------------------------------------
class Wishlist(Base):
    __tablename__ = "wishlists"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    pme_profile_id = Column(Uuid(as_uuid=True), ForeignKey("pme_profiles.id", ondelete="CASCADE"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", backref="wishlists")
    pme_profile = relationship("PMEProfile", backref="wishlisted_by")


# ---------------------------------------------------------------------------
# Banker Simulation Log
# ---------------------------------------------------------------------------
class BankerSimulationLog(Base):
    __tablename__ = "banker_simulation_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_name = Column(String(255), nullable=False)
    capital = Column(Float, nullable=False)
    score = Column(Integer, nullable=False)
    risk_tier = Column(String(50), nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", backref="simulation_logs")
