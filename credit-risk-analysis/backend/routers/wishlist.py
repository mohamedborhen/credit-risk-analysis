from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import uuid

from core.database import get_db
from core.security import get_current_user
from models.orm import User, PMEProfile, Wishlist, ScoreReport

router = APIRouter()

@router.post("/{profile_id}")
def toggle_wishlist(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """TASK 4: Add or remove a PME profile from the user's wishlist."""
    # Ensure profile exists
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid profile ID format")
        
    profile = db.query(PMEProfile).filter(PMEProfile.id == profile_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Check if already in wishlist
    existing = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.pme_profile_id == profile.id
    ).first()

    try:
        if existing:
            # Remove from wishlist
            db.delete(existing)
            action = "removed"
        else:
            # Add to wishlist
            new_wishlist = Wishlist(
                user_id=current_user.id,
                pme_profile_id=profile.id
            )
            db.add(new_wishlist)
            action = "added"
            
        db.commit()
        return {"status": "success", "action": action, "profile_id": str(profile.id)}
    except Exception as e:
        db.rollback()
        print(f"[WISHLIST ERROR] DB write failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating wishlist."
        )

@router.get("/")
def get_wishlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all wishlisted PME profiles for the current user and their mapped details."""
    wishlists = db.query(Wishlist).filter(Wishlist.user_id == current_user.id).all()
    wishlisted_ids = [str(w.pme_profile_id) for w in wishlists]
    
    profiles_payload = []
    for w in wishlists:
        profile = db.query(PMEProfile).filter(PMEProfile.id == w.pme_profile_id).first()
        if profile:
            # Safely grab latest score report dynamically, bypassing strict joins matching the prompt criteria
            latest_report = (
                db.query(ScoreReport)
                .filter(ScoreReport.pme_profile_id == profile.id)
                .order_by(ScoreReport.created_at.desc())
                .first()
            )
            
            fin_grade = "Grade C"
            if latest_report:
                if latest_report.fin_score >= 700:
                    fin_grade = "Grade A"
                elif latest_report.fin_score >= 500:
                    fin_grade = "Grade B"
                    
            profiles_payload.append({
                "id": str(profile.id),
                "name": profile.company_name,
                "sector": profile.sector,
                "governorate": profile.governorate,
                "identifiantRne": profile.identifiant_unique_rne,
                "financialGrade": fin_grade,
                "finScore": latest_report.fin_score if latest_report else 0,
                "riskTier": latest_report.risk_tier if latest_report else "N/A",
                "contactUnlocked": False # We leave it natively false in base lists, logic handled individually
            })

    return {"status": "success", "wishlisted_profile_ids": wishlisted_ids, "profiles": profiles_payload}

@router.delete("/{profile_id}")
def remove_wishlist_item(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Explict removal block explicitly executing Wishlist deletion."""
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid profile ID format")
        
    existing = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.pme_profile_id == profile_uuid
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
    
    return {"status": "success", "action": "removed"}
