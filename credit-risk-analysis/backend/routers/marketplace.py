"""
Marketplace router: browse public PME profiles with their latest scores.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from pydantic import BaseModel
from core.database import get_db
from core.security import get_current_user
from models.orm import PMEProfile, ScoreReport, User, UserRole
from schemas.marketplace import MarketplaceBrowseResponse, MarketplaceListing


router = APIRouter()

class VisibilityToggle(BaseModel):
    visibility_status: str

@router.get("/me")
def get_my_marketplace_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch the authenticated user's current marketplace parameters."""
    profile = db.query(PMEProfile).filter(PMEProfile.user_id == current_user.id).first()
    if not profile:
        return {"error": "No profile found"}
    return {
        "visibility_status": profile.visibility_status,
        "marketplace_status": profile.marketplace_status
    }

@router.put("/visibility")
def toggle_visibility(payload: VisibilityToggle, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Toggle public visibility for the PME. Atomic commit with SQLite lock guard."""
    from fastapi import HTTPException
    from sqlalchemy.exc import OperationalError

    profile = db.query(PMEProfile).filter(PMEProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="PME profile not found.")

    profile.visibility_status = payload.visibility_status
    profile.marketplace_status = 1 if payload.visibility_status == "Public" else 0

    try:
        # Atomic Commit — persists visibility in finscore.db
        db.commit()
        db.refresh(profile)
    except OperationalError as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database locked or write error: {str(e)}. Please retry in a moment."
        )

    return {
        "success": True,
        "visibility_status": profile.visibility_status,
        "marketplace_status": profile.marketplace_status,
        "profile_id": str(profile.id),
        "rne_id": profile.identifiant_unique_rne or str(profile.id)[:8],
    }



@router.get("/browse", response_model=MarketplaceBrowseResponse)
def browse_marketplace(
    skip: int = Query(default=0, ge=0, description="Pagination offset"),
    limit: int = Query(default=20, ge=1, le=100, description="Page size"),
    sector: str | None = Query(default=None, description="Filter by sector"),
    db: Session = Depends(get_db),
):
    """
    Browse PME profiles that are publicly listed on the marketplace.
    Returns company info along with their latest FinScore.
    Available to all users (investors / banks).
    """
    query = db.query(PMEProfile).filter(PMEProfile.visibility_status == "Public").order_by(PMEProfile.marketplace_status.desc())

    if sector:
        query = query.filter(PMEProfile.sector == sector)

    total = query.count()
    profiles = query.offset(skip).limit(limit).all()

    listings = []
    for profile in profiles:
        # Get the latest score report for this profile
        latest_report = (
            db.query(ScoreReport)
            .filter(ScoreReport.pme_profile_id == profile.id)
            .order_by(ScoreReport.created_at.desc())
            .first()
        )

        # Calculate an abstracted financial grade from the score (simulation logic)
        fin_grade = "Grade C"
        if latest_report:
            if latest_report.fin_score >= 700:
                fin_grade = "Grade A"
            elif latest_report.fin_score >= 500:
                fin_grade = "Grade B"

        listings.append(
            MarketplaceListing(
                company_name=profile.company_name,
                sector=profile.sector,
                governorate=profile.governorate,
                identifiant_unique_rne=profile.identifiant_unique_rne,
                marketplace_status=profile.marketplace_status,
                financial_grade=fin_grade,
                latest_fin_score=latest_report.fin_score if latest_report else None,
                latest_risk_tier=latest_report.risk_tier if latest_report else None,
                contact_unlocked=False,
                profile_id=str(profile.id),
            )
        )

    return MarketplaceBrowseResponse(total=total, listings=listings)


@router.get("/{profile_id}/similar", response_model=MarketplaceBrowseResponse)
def get_similar_profiles(profile_id: str, db: Session = Depends(get_db)):
    """Suggests similar profiles based on Governorate and Sector."""
    target = db.query(PMEProfile).filter(PMEProfile.id == profile_id).first()
    if not target:
        return MarketplaceBrowseResponse(total=0, listings=[])
        
    query = db.query(PMEProfile).filter(
        PMEProfile.visibility_status == "Public",
        PMEProfile.id != profile_id,
        (PMEProfile.governorate == target.governorate) | (PMEProfile.sector == target.sector)
    ).limit(5)
    
    profiles = query.all()
    listings = []
    
    for profile in profiles:
        latest_report = db.query(ScoreReport).filter(ScoreReport.pme_profile_id == profile.id).order_by(ScoreReport.created_at.desc()).first()
        fin_grade = "Grade A" if latest_report and latest_report.fin_score >= 700 else ("Grade B" if latest_report and latest_report.fin_score >= 500 else "Grade C")
        
        listings.append(
            MarketplaceListing(
                company_name=profile.company_name,
                sector=profile.sector,
                governorate=profile.governorate,
                identifiant_unique_rne=profile.identifiant_unique_rne,
                marketplace_status=profile.marketplace_status,
                financial_grade=fin_grade,
                latest_fin_score=latest_report.fin_score if latest_report else None,
                latest_risk_tier=latest_report.risk_tier if latest_report else None,
                contact_unlocked=False,
                profile_id=str(profile.id),
            )
        )
        
    return MarketplaceBrowseResponse(total=len(listings), listings=listings)


@router.post("/{profile_id}/unlock_contact")
def unlock_contact(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """TASK 2: Deduct 1 credit and return contact info. Requires authentication."""
    from sqlalchemy.exc import OperationalError
    import uuid

    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid profile ID format")

    # Check credits
    if current_user.credits <= 0:
        print(f"[UNLOCK] {current_user.email} has 0 credits — blocked.")
        raise HTTPException(
            status_code=402,
            detail="Out of credits"
        )

    profile = db.query(PMEProfile).filter(PMEProfile.id == profile_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        current_user.credits -= 1
        db.commit()
        db.refresh(current_user)
        print(f"[UNLOCK] {current_user.email} unlocked {profile_id} | remaining credits={current_user.credits}")
    except Exception as e:
        db.rollback()
        print(f"[UNLOCK ERROR] DB write failed: {e}")
        raise HTTPException(status_code=500, detail="Database error during credit deduction.")

    # Resolve real contact info: prefer profile fields, fall back to the
    # PME owner's registration email so every company gets unique data.
    pme_owner = db.query(User).filter(User.id == profile.user_id).first()
    resolved_email = profile.contact_email or (pme_owner.email if pme_owner else "N/A")
    resolved_phone = profile.contact_phone or "+216 —"

    return {
        "success": True,
        "credits_remaining": current_user.credits,
        "contact_email": resolved_email,
        "contact_phone": resolved_phone,
        "message": "Contact information unlocked.",
    }

