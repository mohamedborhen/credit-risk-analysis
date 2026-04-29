"""
Scoring router: predict and what-if simulation endpoints.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from ml_services.predictor import model_loader
from models.orm import FinancialData, PMEProfile, ScoreReport, User, UserRole, BankerSimulationLog
from schemas.scoring import FinancialInput, ScoreResponse, BankerSimulationLogInput

router = APIRouter()


def _features_dict(payload: FinancialInput) -> dict:
    """Convert Pydantic input into the dict format expected by the ML predictor."""
    return payload.model_dump(exclude_none=False)


@router.post("/predict", response_model=ScoreResponse, status_code=status.HTTP_201_CREATED)
def predict_score(
    payload: FinancialInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run credit scoring on submitted financial data.
    Saves the FinancialData and ScoreReport to the database.
    Requires authentication (PME role).
    """
    # Verify PME role
    if current_user.role != UserRole.PME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only PME users can submit scoring requests",
        )

    # Get PME profile
    profile = db.query(PMEProfile).filter(PMEProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PME profile not found. Please complete registration.",
        )

    # Run ML prediction
    if not model_loader.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are not loaded. Please try again later.",
        )

    features = _features_dict(payload)
    result = model_loader.predict(features)

    # Save FinancialData
    fin_data = FinancialData(
        pme_profile_id=profile.id,
        business_turnover_tnd=payload.business_turnover_tnd,
        business_expenses_tnd=payload.business_expenses_tnd,
        profit_margin=payload.profit_margin,
        nbr_of_workers=payload.nbr_of_workers,
        workers_verified_cnss=payload.workers_verified_cnss,
        formal_worker_ratio=payload.formal_worker_ratio,
        business_age_years=payload.business_age_years,
        number_of_owners=payload.number_of_owners,
        compliance_rne_score=payload.compliance_rne_score,
        steg_sonede_score=payload.steg_sonede_score,
        banking_maturity_score=payload.banking_maturity_score,
        followers_fcb=payload.followers_fcb,
        followers_insta=payload.followers_insta,
        followers_linkedin=payload.followers_linkedin,
        posts_per_month=payload.posts_per_month,
        type_of_business=payload.type_of_business,
    )
    db.add(fin_data)
    db.flush()

    # Calculate traffic-light grades for persistence
    cnss_ratio = payload.formal_worker_ratio if payload.formal_worker_ratio else 0
    cnss_grade = "🟢 High Compliance" if cnss_ratio > 0.8 else ("🟡 Minor Issues" if cnss_ratio >= 0.5 else "🔴 High Risk")
    
    op_avg = ((payload.compliance_rne_score or 5) + (payload.steg_sonede_score or 5)) / 2
    op_grade = "🟢 High Compliance" if op_avg >= 8 else ("🟡 Minor Issues" if op_avg >= 5 else "🔴 High Risk")

    # Save ScoreReport
    report = ScoreReport(
        financial_data_id=fin_data.id,
        pme_profile_id=profile.id,
        fin_score=result["score"],
        risk_tier=result["risk_tier"],
        decision=result["decision"],
        decision_explanation=result["decision_explanation"],
        shap_explanations_json=json.dumps(result["shap_explanations"], default=str),
        model1_probability=result["probabilities"]["model1_financial"],
        model2_probability=result["probabilities"]["model2_behavioral"],
        stacked_probability=result["probabilities"]["stacked_final"],
        cnss_score_grade=cnss_grade,
        op_integrity_index=op_grade,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return ScoreResponse(
        score=result["score"],
        risk_tier=result["risk_tier"],
        decision=result["decision"],
        decision_explanation=result["decision_explanation"],
        probabilities=result["probabilities"],
        strengths=result["strengths"],
        weaknesses=result["weaknesses"],
        is_simulation=False,
        report_id=str(report.id),
        cnss_score_grade=cnss_grade,
        op_integrity_index=op_grade,
    )


@router.post("/what-if", response_model=ScoreResponse)
def what_if_simulation(
    payload: FinancialInput,
    current_user: User = Depends(get_current_user),
):
    """
    Run a hypothetical what-if scoring simulation.
    Returns the predicted score WITHOUT saving anything to the database.
    Available to both PME and BANK users.
    """
    if not model_loader.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are not loaded. Please try again later.",
        )

    features = _features_dict(payload)
    result = model_loader.predict(features)

    # Mock calculation for simulations
    cnss_ratio = payload.formal_worker_ratio if payload.formal_worker_ratio else 0
    cnss_grade = "🟢 High Compliance" if cnss_ratio > 0.8 else ("🟡 Minor Issues" if cnss_ratio >= 0.5 else "🔴 High Risk")
    op_avg = ((payload.compliance_rne_score or 5) + (payload.steg_sonede_score or 5)) / 2
    op_grade = "🟢 High Compliance" if op_avg >= 8 else ("🟡 Minor Issues" if op_avg >= 5 else "🔴 High Risk")

    return ScoreResponse(
        score=result["score"],
        risk_tier=result["risk_tier"],
        decision=result["decision"],
        decision_explanation=result["decision_explanation"],
        probabilities=result["probabilities"],
        strengths=result["strengths"],
        weaknesses=result["weaknesses"],
        is_simulation=True,
        report_id=None,
        cnss_score_grade=cnss_grade,
        op_integrity_index=op_grade,
    )


@router.get("/latest", response_model=FinancialInput)
def get_latest_financial_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch the most recent financial data for the authenticated PME user
    to automatically populate their dashboard forms instead of asking twice.
    """
    if current_user.role != UserRole.PME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only PME users have financial data profiles",
        )

    profile = db.query(PMEProfile).filter(PMEProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    latest_data = (
        db.query(FinancialData)
        .filter(FinancialData.pme_profile_id == profile.id)
        .order_by(FinancialData.created_at.desc())
        .first()
    )

    if not latest_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No financial data found")

    return FinancialInput(
        company_name=profile.company_name,
        type_of_business=latest_data.type_of_business or "Services",
        business_turnover_tnd=latest_data.business_turnover_tnd,
        business_expenses_tnd=latest_data.business_expenses_tnd,
        profit_margin=latest_data.profit_margin,
        nbr_of_workers=latest_data.nbr_of_workers,
        workers_verified_cnss=latest_data.workers_verified_cnss,
        formal_worker_ratio=latest_data.formal_worker_ratio,
        business_age_years=latest_data.business_age_years,
        number_of_owners=latest_data.number_of_owners,
        compliance_rne_score=latest_data.compliance_rne_score or 5,
        steg_sonede_score=latest_data.steg_sonede_score or 5,
        banking_maturity_score=latest_data.banking_maturity_score or 5,
        followers_fcb=latest_data.followers_fcb,
        followers_linkedin=latest_data.followers_linkedin,
        posts_per_month=latest_data.posts_per_month,
    )

@router.delete("/prediction/{id}")
def delete_prediction(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """TASK 2: Delete a specific prediction belonging to the current user."""
    import uuid
    try:
        score_id = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid prediction ID format")

    report = db.query(ScoreReport).filter(ScoreReport.id == score_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Prediction not found")

    # Authorize owner
    profile = db.query(PMEProfile).filter(PMEProfile.id == report.pme_profile_id).first()
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You are not the owner of this prediction")

    try:
        # Delete related financial data alongside it to keep it clean natively.
        if report.financial_data_id:
            fin_data = db.query(FinancialData).filter(FinancialData.id == report.financial_data_id).first()
            if fin_data:
                db.delete(fin_data)
        
        db.delete(report)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"status": "success", "message": "Prediction deleted"}

@router.post("/logs")
def save_simulation_log(
    payload: BankerSimulationLogInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """TASK 3: Save a banker simulation to the database natively without arbitrary references."""
    if current_user.role != UserRole.BANK:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only bankers can save simulation logs.",
        )
        
    log = BankerSimulationLog(
        user_id=current_user.id,
        company_name=payload.company_name,
        capital=payload.capital,
        score=payload.score,
        risk_tier=payload.risk_tier,
    )
    db.add(log)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"status": "success", "message": "Simulation log saved!"}
