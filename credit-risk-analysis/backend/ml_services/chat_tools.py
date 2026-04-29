"""
Chatbot tool functions for FinScore PME.

These tools are called by the chat agent layer based on intent routing.
Each function returns structured, serializable context for LLM generation.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from models.orm import FinancialData, PMEProfile, ScoreReport, User

logger = logging.getLogger(__name__)


def _to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


def _normalize_user_id(user_id: str | int) -> str:
    return str(user_id).strip()


def _parse_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError):
        return None


def _resolve_user_and_profile(db: Session, user_id: str | int) -> tuple[User | None, PMEProfile | None]:
    """
    Resolve both user and PME profile from a supplied id.

    Accepted identifiers:
    - user UUID (users.id)
    - profile UUID (pme_profiles.id)
    """
    raw_id = _normalize_user_id(user_id)
    parsed_uuid = _parse_uuid(raw_id)

    if not parsed_uuid:
        return None, None

    user = db.query(User).filter(User.id == parsed_uuid).first()
    if user:
        profile = db.query(PMEProfile).filter(PMEProfile.user_id == user.id).first()
        return user, profile

    profile = db.query(PMEProfile).filter(PMEProfile.id == parsed_uuid).first()
    if profile:
        linked_user = db.query(User).filter(User.id == profile.user_id).first()
        return linked_user, profile

    return None, None


def _pretty_feature_name(feature: str) -> str:
    return feature.replace("_", " ").title()


def get_finscore(user_id: str | int, db: Session) -> dict[str, Any]:
    """Return the latest FinScore and risk summary for a user."""
    user, profile = _resolve_user_and_profile(db=db, user_id=user_id)

    if not user:
        return {
            "available": False,
            "reason": "user_not_found",
            "message": "User not found. Ensure user_id is a valid platform UUID.",
        }

    if not profile:
        return {
            "available": False,
            "reason": "pme_profile_not_found",
            "message": "No PME profile is linked to this user.",
            "user": {"id": str(user.id), "email": user.email, "role": user.role.value},
        }

    latest_report = (
        db.query(ScoreReport)
        .filter(ScoreReport.pme_profile_id == profile.id)
        .order_by(ScoreReport.created_at.desc())
        .first()
    )

    if not latest_report:
        return {
            "available": False,
            "reason": "score_not_found",
            "message": "No score report exists for this user yet.",
            "profile": {
                "profile_id": str(profile.id),
                "company_name": profile.company_name,
            },
        }

    return {
        "available": True,
        "profile_id": str(profile.id),
        "company_name": profile.company_name,
        "score": latest_report.fin_score,
        "risk_tier": latest_report.risk_tier,
        "decision": latest_report.decision,
        "decision_explanation": latest_report.decision_explanation,
        "probabilities": {
            "model1_financial": latest_report.model1_probability,
            "model2_behavioral": latest_report.model2_probability,
            "stacked_final": latest_report.stacked_probability,
        },
        "report_meta": {
            "report_id": str(latest_report.id),
            "created_at": _to_iso(latest_report.created_at),
            "cnss_score_grade": latest_report.cnss_score_grade,
            "op_integrity_index": latest_report.op_integrity_index,
        },
    }


def get_shap_explanation(user_id: str | int, db: Session) -> dict[str, Any]:
    """Return explainability data from the latest score report."""
    user, profile = _resolve_user_and_profile(db=db, user_id=user_id)

    if not user or not profile:
        return {
            "available": False,
            "reason": "profile_context_missing",
            "message": "Cannot build explanations without a valid user and PME profile.",
        }

    latest_report = (
        db.query(ScoreReport)
        .filter(ScoreReport.pme_profile_id == profile.id)
        .order_by(ScoreReport.created_at.desc())
        .first()
    )

    if not latest_report or not latest_report.shap_explanations_json:
        return {
            "available": False,
            "reason": "shap_not_found",
            "message": "No SHAP explanation data found for the latest report.",
        }

    try:
        raw_scores = json.loads(latest_report.shap_explanations_json)
    except json.JSONDecodeError:
        logger.exception("Invalid shap_explanations_json for report_id=%s", latest_report.id)
        return {
            "available": False,
            "reason": "shap_parse_error",
            "message": "Stored SHAP data is invalid and could not be parsed.",
        }

    if not isinstance(raw_scores, dict):
        return {
            "available": False,
            "reason": "shap_invalid_type",
            "message": "SHAP payload has unexpected format.",
        }

    feature_importance = []
    for feature, value in raw_scores.items():
        try:
            score = float(value)
        except (TypeError, ValueError):
            continue

        impact = round((score - 0.5) * 0.3, 4)
        feature_importance.append(
            {
                "feature": feature,
                "label": _pretty_feature_name(feature),
                "normalized_value": round(score, 4),
                "impact": impact,
            }
        )

    feature_importance.sort(key=lambda item: abs(item["impact"]), reverse=True)
    top_positive = [row for row in feature_importance if row["impact"] > 0][:5]
    top_negative = [row for row in feature_importance if row["impact"] < 0][:5]

    return {
        "available": True,
        "report_id": str(latest_report.id),
        "created_at": _to_iso(latest_report.created_at),
        "feature_importance": feature_importance,
        "top_positive_drivers": top_positive,
        "top_negative_drivers": top_negative,
    }


def get_sme_profile(user_id: str | int, db: Session) -> dict[str, Any]:
    """Return user/company profile plus latest submitted financial snapshot."""
    user, profile = _resolve_user_and_profile(db=db, user_id=user_id)

    if not user:
        return {
            "available": False,
            "reason": "user_not_found",
            "message": "User not found.",
        }

    if not profile:
        return {
            "available": False,
            "reason": "pme_profile_not_found",
            "message": "No PME profile is linked to this user.",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "role": user.role.value,
            },
        }

    latest_data = (
        db.query(FinancialData)
        .filter(FinancialData.pme_profile_id == profile.id)
        .order_by(FinancialData.created_at.desc())
        .first()
    )

    latest_report = (
        db.query(ScoreReport)
        .filter(ScoreReport.pme_profile_id == profile.id)
        .order_by(ScoreReport.created_at.desc())
        .first()
    )

    financial_snapshot = None
    if latest_data:
        financial_snapshot = {
            "business_turnover_tnd": latest_data.business_turnover_tnd,
            "business_expenses_tnd": latest_data.business_expenses_tnd,
            "profit_margin": latest_data.profit_margin,
            "nbr_of_workers": latest_data.nbr_of_workers,
            "workers_verified_cnss": latest_data.workers_verified_cnss,
            "formal_worker_ratio": latest_data.formal_worker_ratio,
            "business_age_years": latest_data.business_age_years,
            "number_of_owners": latest_data.number_of_owners,
            "compliance_rne_score": latest_data.compliance_rne_score,
            "steg_sonede_score": latest_data.steg_sonede_score,
            "banking_maturity_score": latest_data.banking_maturity_score,
            "followers_fcb": latest_data.followers_fcb,
            "followers_insta": latest_data.followers_insta,
            "followers_linkedin": latest_data.followers_linkedin,
            "posts_per_month": latest_data.posts_per_month,
            "created_at": _to_iso(latest_data.created_at),
        }

    return {
        "available": True,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "created_at": _to_iso(user.created_at),
        },
        "profile": {
            "profile_id": str(profile.id),
            "company_name": profile.company_name,
            "identifiant_unique_rne": profile.identifiant_unique_rne,
            "sector": profile.sector,
            "governorate": profile.governorate,
            "visibility_status": profile.visibility_status,
            "marketplace_status": profile.marketplace_status,
            "contact_email": profile.contact_email,
            "contact_phone": profile.contact_phone,
            "created_at": _to_iso(profile.created_at),
        },
        "latest_financial_snapshot": financial_snapshot,
        "latest_score": {
            "score": latest_report.fin_score if latest_report else None,
            "risk_tier": latest_report.risk_tier if latest_report else None,
            "decision": latest_report.decision if latest_report else None,
            "created_at": _to_iso(latest_report.created_at) if latest_report else None,
        },
    }
